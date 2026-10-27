package app.carbonwallet.ghar

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** The home this phone shows: the first one the account belongs to (the website can switch between several). */
data class ActiveHome(val id: String, val name: String, val role: String) {
    val isOwner get() = role == "OWNER"
    val canAddBills get() = role == "OWNER" || role == "MEMBER"
}

fun activeHome(): ActiveHome? = Session.me?.households?.firstOrNull()?.let { ActiveHome(it.id, it.name, it.role) }

fun homePath(id: String, rest: String) = "/api/households/$id/$rest"

/** Runs [content] with the active home, or offers to join one with the family's code. */
@Composable
fun WithHome(content: @Composable (ActiveHome) -> Unit) {
    val home = activeHome()
    if (home != null) content(home) else JoinHome()
}

@Composable
private fun JoinHome() {
    val scope = rememberCoroutineScope()
    var code by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        EmptyState(
            Lucide.Home,
            t("Join your home", "अपने घर से जुड़ें"),
            t(
                "Ask the owner for the home's join code (it's in Settings on the website), or create a home on the website.",
                "घर के मालिक से जॉइन कोड लें (वेबसाइट की सेटिंग में है), या वेबसाइट पर नया घर बनाएँ।",
            ),
        )
        error?.let { Banner(Tone.BAD, it) }
        CwTextField(code, { code = it.uppercase().take(12) }, t("Join code", "जॉइन कोड"), icon = Lucide.Users)
        PrimaryButton(t("Join", "जुड़ें"), {
            busy = true
            error = null
            scope.launch {
                try {
                    Http.sendText("POST", "/api/join", buildJsonObject { put("code", code.trim()) })
                    Session.refreshMe()
                } catch (e: Exception) {
                    error = e.message
                }
                busy = false
            }
        }, Modifier.fillMaxWidth(), busy = busy, enabled = code.length >= 4, color = Cw.govNavy)
        Text(
            t("Members see the home's numbers; the owner decides who can add bills.", "सदस्य घर के आँकड़े देख सकते हैं; बिल कौन जोड़े, यह मालिक तय करते हैं।"),
            style = MaterialTheme.typography.bodySmall,
            color = Cw.inkMuted,
        )
    }
}
