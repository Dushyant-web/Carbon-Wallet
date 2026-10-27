package app.carbonwallet.core.net

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.carbonwallet.core.model.GoogleTokenResponse
import app.carbonwallet.core.model.Me
import app.carbonwallet.flavor.CurrentFlavor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

sealed interface AuthState {
    data object Checking : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val me: Me) : AuthState
}

/**
 * Who is signed in. The website issues one random session token (it keeps only its hash);
 * the app holds it in the Keystore-backed [TokenVault] and sends it as a Bearer header.
 */
object Session {
    private lateinit var vault: TokenVault
    private lateinit var prefs: SharedPreferences
    private val cookie = Regex("cw_session=([A-Za-z0-9_-]{20,100})")

    @Volatile
    var token: String? = null
        private set

    private val _state = MutableStateFlow<AuthState>(AuthState.Checking)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    /** One-line message for the sign-in screen, e.g. after the session ran out. */
    var notice by mutableStateOf<String?>(null)

    val me: Me? get() = (state.value as? AuthState.SignedIn)?.me

    fun init(context: Context) {
        vault = TokenVault(context)
        prefs = context.getSharedPreferences("cw_session", Context.MODE_PRIVATE)
        token = vault.read()
        val cachedMe = prefs.getString("me", null)?.let { runCatching { Http.json.decodeFromString(Me.serializer(), it) }.getOrNull() }
        // With a saved token the app opens straight onto the last screens; /me is re-checked in the background
        _state.value = when {
            token == null -> AuthState.SignedOut
            cachedMe != null -> AuthState.SignedIn(cachedMe)
            else -> AuthState.Checking
        }
    }

    suspend fun refreshMe() {
        if (token == null) return
        val me = Http.get("/api/auth/me", Me.serializer())
        remember(me)
    }

    suspend fun login(email: String, password: String): Me {
        val body = buildJsonObject {
            put("email", email.trim().lowercase())
            put("password", password)
        }
        var issued: String? = null
        val request = Request.Builder()
            .url(Http.url("/api/auth/login"))
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        Http.execute(request) { res -> issued = res.headers("Set-Cookie").firstNotNullOfOrNull { cookie.find(it)?.groupValues?.get(1) } }
        return adopt(issued ?: throw ApiException(500, "Signed in, but the server sent no session. Try again."))
    }

    /** [asRole] is "household" or "merchant": Google sign-up creates that kind of account. */
    suspend fun loginWithGoogle(idToken: String, asRole: String): Me {
        val body = buildJsonObject {
            put("idToken", idToken)
            put("as", asRole)
        }
        val res = Http.send("POST", "/api/auth/google/idtoken", body, GoogleTokenResponse.serializer())
        return adopt(res.token)
    }

    private suspend fun adopt(newToken: String): Me {
        token = newToken
        val me = try {
            Http.get("/api/auth/me", Me.serializer())
        } catch (e: Exception) {
            token = null
            throw e
        }
        CurrentFlavor.accountProblem(me)?.let { (en, _) ->
            serverLogout(newToken)
            token = null
            throw ApiException(403, en)
        }
        vault.write(newToken)
        notice = null
        remember(me)
        return me
    }

    private fun remember(me: Me) {
        prefs.edit().putString("me", Http.json.encodeToString(Me.serializer(), me)).apply()
        _state.value = AuthState.SignedIn(me)
    }

    suspend fun logout() {
        token?.let { serverLogout(it) }
        clearLocal()
    }

    /** The server said 401: the session ended (expired, signed out elsewhere, or account disabled). */
    fun expire() {
        if (token == null) return
        clearLocal()
        notice = "Your session ended. Please sign in again."
    }

    private suspend fun serverLogout(t: String) {
        // the logout route reads the cookie, so send the token that way too
        runCatching { Http.sendText("POST", "/api/auth/logout", null, mapOf("Cookie" to "cw_session=$t")) }
    }

    private fun clearLocal() {
        token = null
        vault.clear()
        prefs.edit().clear().apply()
        Store.clear()
        _state.value = AuthState.SignedOut
    }
}
