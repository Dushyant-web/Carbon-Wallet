package app.carbonwallet.core.net

import android.content.Context
import android.util.Log
import app.carbonwallet.BuildConfig
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * Stale-while-revalidate cache for GET calls. A screen first shows what it had (memory, then the phone's disk,
 * so it opens offline), then swaps in fresh data. Cleared on sign-out, so one account never sees another's data.
 */
object Store {
    private val memory = ConcurrentHashMap<String, String>()
    private lateinit var dir: File
    private val _version = MutableStateFlow(0)

    /** Bumped after any change (a bill confirmed, a shop approved…) so every visible screen reloads. */
    val version: StateFlow<Int> = _version.asStateFlow()

    fun init(context: Context) {
        dir = File(context.filesDir, "api-cache")
    }

    private fun file(path: String): File {
        val hash = MessageDigest.getInstance("SHA-1").digest(path.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(dir, "$hash.json")
    }

    fun peek(path: String): String? = memory[path]

    suspend fun cached(path: String): String? = memory[path] ?: withContext(Dispatchers.IO) {
        file(path).takeIf { it.exists() }?.readText()
    }?.also { memory[path] = it }

    /**
     * One request per path at a time: a screen and the background prefetch asking for the same data share a
     * single call, which matters when each call takes seconds on a slow server.
     */
    suspend fun fetch(path: String): String {
        val call = inFlight.computeIfAbsent(path) { background.async(start = CoroutineStart.LAZY) { load(path) } }
        try {
            return call.await()
        } finally {
            inFlight.remove(path, call)
        }
    }

    private val inFlight = ConcurrentHashMap<String, Deferred<String>>()
    // outlives the screen that asked, so a call already under way still fills the cache if the person moves on
    private val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // bumped on sign-out: an answer that arrives afterwards must not land in the next person's cache
    @Volatile
    private var generation = 0

    private suspend fun load(path: String): String {
        val started = generation
        val text = try {
            Http.getText(path)
        } catch (e: ApiException) {
            // the hosted server sometimes fails one call when many arrive together; a second try usually works
            if (e.status < 500) throw e
            delay(1500)
            Http.getText(path)
        }
        if (started == generation) {
            memory[path] = text
            withContext(Dispatchers.IO) {
                dir.mkdirs()
                file(path).writeText(text)
            }
        }
        return text
    }

    /** Warms the cache for the screens a person is likely to open next, a few at a time so the open screen goes first. */
    fun prefetch(scope: CoroutineScope, paths: List<String>) {
        val slots = Semaphore(3)
        scope.launch {
            paths.map { p -> async { slots.withPermit { runCatching { fetch(p) } } } }.awaitAll()
        }
    }

    fun changed() {
        _version.value++
    }

    fun clear() {
        generation++
        inFlight.clear()
        memory.clear()
        if (::dir.isInitialized) dir.deleteRecursively()
    }
}

class Remote<T>(
    val data: T?,
    val loading: Boolean,
    val error: String?,
    val refresh: () -> Unit,
)

/** Loads [path] through the [Store]: instant from cache, then fresh from the server. A null path loads nothing. */
@Composable
fun <T> rememberRemote(path: String?, de: DeserializationStrategy<T>): Remote<T> {
    val version by Store.version.collectAsState()
    var manual by remember(path) { mutableIntStateOf(0) }
    var data by remember(path) {
        mutableStateOf(path?.let { Store.peek(it) }?.let { runCatching { Http.json.decodeFromString(de, it) }.getOrNull() })
    }
    var loading by remember(path) { mutableStateOf(path != null) }
    var error by remember(path) { mutableStateOf<String?>(null) }

    LaunchedEffect(path, version, manual) {
        if (path == null) {
            loading = false
            return@LaunchedEffect
        }
        loading = true
        error = null
        if (data == null) {
            Store.cached(path)?.let { cached ->
                runCatching { withContext(Dispatchers.Default) { Http.json.decodeFromString(de, cached) } }.getOrNull()?.let { data = it }
            }
        }
        try {
            val text = Store.fetch(path)
            data = withContext(Dispatchers.Default) { Http.json.decodeFromString(de, text) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.w("CwStore", "GET $path failed", e)
            error = e.message ?: "Couldn't load this."
        }
        loading = false
    }
    return Remote(data, loading, error) { manual++ }
}
