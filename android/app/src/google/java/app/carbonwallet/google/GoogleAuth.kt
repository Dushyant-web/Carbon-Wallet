package app.carbonwallet.google

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import app.carbonwallet.BuildConfig
import app.carbonwallet.core.net.ApiException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * "Continue with Google" through Credential Manager. The ID token goes to /api/auth/google/idtoken, which checks
 * its signature and audience on the server and returns our own session token.
 */
object GoogleAuth {
    suspend fun idToken(activity: Activity): String {
        val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val result = try {
            CredentialManager.create(activity).getCredential(activity, request)
        } catch (e: GetCredentialCancellationException) {
            throw ApiException(0, "Google sign-in was cancelled.")
        } catch (e: NoCredentialException) {
            throw ApiException(0, "No Google account on this phone. Add one in Settings, or use email and password.")
        } catch (e: GetCredentialException) {
            throw ApiException(0, "Google sign-in didn't work: ${e.message ?: e.type}")
        }
        val credential = result.credential
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            return GoogleIdTokenCredential.createFrom(credential.data).idToken
        }
        throw ApiException(0, "Google didn't return an account.")
    }
}
