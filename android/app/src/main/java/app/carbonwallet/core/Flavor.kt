package app.carbonwallet.core

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import app.carbonwallet.core.model.Me
import app.carbonwallet.core.shell.Nav

/** What makes Ghar, Dukaan and Admin different. Each build flavour provides one `CurrentFlavor`. */
interface FlavorSpec {
    val serviceEn: String
    val serviceHi: String

    /** The bottom bar, in order. The first tab opens on launch. */
    val tabs: List<TabSpec>

    /** Null when this account can use this app; otherwise why not, in English and Hindi. */
    fun accountProblem(me: Me): Pair<String, String>?

    /** Asks Google (Credential Manager) for an ID token, or null when this app has no Google sign-in. */
    val googleIdToken: (suspend (Activity) -> String)?

    /** "household" or "merchant", sent with the Google token so a first sign-in makes the right account. */
    val googleRole: String?

    /** Debug builds only: one tap fills a demo login from ACCOUNTS.md. */
    val demoAccounts: List<DemoAccount>

    /** Screens to load in the background right after sign-in, so switching tabs is instant. */
    fun prefetch(me: Me): List<String>
}

data class TabSpec(
    val en: String,
    val hi: String,
    val icon: ImageVector,
    val content: @Composable (Nav) -> Unit,
)

data class DemoAccount(val label: String, val email: String, val password: String)
