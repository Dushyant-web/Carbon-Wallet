package app.carbonwallet.core.net

import android.content.Context
import app.carbonwallet.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.ConnectionPool
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** An error the server or the network gave, already in words a person can read. */
class ApiException(val status: Int, message: String) : IOException(message)

/**
 * One OkHttp client for the whole app: a warm connection pool and HTTP/2 to the website keep every call short.
 * The session token goes out as `Authorization: Bearer …`, which the website accepts from the apps.
 */
object Http {
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    private val JSON_TYPE = "application/json; charset=utf-8".toMediaType()

    val baseUrl: String = BuildConfig.API_URL.trimEnd('/')
    val configured: Boolean get() = baseUrl.startsWith("http")

    lateinit var client: OkHttpClient
        private set

    fun init(context: Context, userAgent: String) {
        client = OkHttpClient.Builder()
            .connectionPool(ConnectionPool(5, 5, TimeUnit.MINUTES))
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS) // bill reading runs OCR on the server
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val request = chain.request()
                val builder = request.newBuilder().header("User-Agent", userAgent)
                val token = Session.token
                // never hand the session token to any host other than our own
                if (token != null && request.url.toString().startsWith(baseUrl)) {
                    builder.header("Authorization", "Bearer $token")
                }
                chain.proceed(builder.build())
            }
            .build()
    }

    fun url(path: String) = if (path.startsWith("http")) path else baseUrl + path

    suspend fun getText(path: String): String = execute(Request.Builder().url(url(path)).get().build())

    suspend fun <T> get(path: String, de: DeserializationStrategy<T>): T = json.decodeFromString(de, getText(path))

    suspend fun <T> send(method: String, path: String, body: JsonElement?, de: DeserializationStrategy<T>): T {
        val text = sendText(method, path, body)
        return json.decodeFromString(de, text.ifBlank { "{}" })
    }

    suspend fun sendText(method: String, path: String, body: JsonElement?, extraHeaders: Map<String, String> = emptyMap()): String {
        val payload: RequestBody = (body?.toString() ?: "{}").toRequestBody(JSON_TYPE)
        val builder = Request.Builder().url(url(path)).method(method, payload)
        extraHeaders.forEach { (k, v) -> builder.header(k, v) }
        return execute(builder.build())
    }

    suspend fun upload(path: String, form: MultipartBody): String =
        execute(Request.Builder().url(url(path)).post(form).build())

    /** Runs a call off the main thread and returns the body; also hands the raw response to [onResponse] (for Set-Cookie on login). */
    suspend fun execute(request: Request, onResponse: (Response) -> Unit = {}): String = withContext(Dispatchers.IO) {
        if (!configured) throw ApiException(0, "This build has no server address. Set cw.releaseApiUrl and rebuild.")
        val response = try {
            client.newCall(request).await()
        } catch (e: IOException) {
            throw ApiException(0, "No connection to Carbon Wallet. Check the internet and try again.")
        }
        response.use { res ->
            onResponse(res)
            val text = res.body.string()
            if (!res.isSuccessful) {
                if (res.code == 401 && Session.token != null) Session.expire()
                throw ApiException(res.code, errorMessage(res.code, text))
            }
            text
        }
    }

    private fun errorMessage(code: Int, body: String): String {
        val fromServer = runCatching { json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull()
        if (!fromServer.isNullOrBlank()) return fromServer
        return when (code) {
            401 -> "Please sign in again."
            403 -> "You can't do this with this account."
            404 -> "Not found."
            429 -> "Too many tries. Wait a minute and try again."
            in 500..599 -> "The server had a problem. Try again in a moment."
            else -> "Something went wrong ($code)."
        }
    }
}

private suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = cont.resume(response) { _, r, _ -> r.close() }
        override fun onFailure(call: Call, e: IOException) {
            if (!cont.isCancelled) cont.resumeWithException(e)
        }
    })
    cont.invokeOnCancellation { runCatching { cancel() } }
}
