package app.carbonwallet.core.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.carbonwallet.BuildConfig
import app.carbonwallet.core.FlavorSpec
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.InfoRow
import app.carbonwallet.core.ui.Lang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.SecondaryButton
import app.carbonwallet.core.ui.UiPrefs
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(flavor: FlavorSpec) {
    val me = Session.me ?: return
    val scope = rememberCoroutineScope()
    var confirm by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        CwCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(52.dp).background(Cw.govNavy, CircleShape), contentAlignment = Alignment.Center) {
                    Text(me.user.name.take(1).uppercase(), color = Color.White, style = MaterialTheme.typography.headlineSmall)
                }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(me.user.name, style = MaterialTheme.typography.titleLarge)
                    Text(me.user.email, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                }
            }
            Spacer(Modifier.height(10.dp))
            InfoRow(t("Account", "खाता"), roleWord(me.user.platformRole))
            me.households.forEach { h -> InfoRow(t("Home", "घर"), "${h.name} · ${memberRole(h.role)}") }
        }

        Eyebrow(t("Display", "दिखावट"))
        CwCard {
            Text(t("Language", "भाषा"), style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(8.dp))
            Choice(listOf("English" to Lang.EN, "हिंदी" to Lang.HI), UiPrefs.lang) { UiPrefs.updateLang(it) }
            Spacer(Modifier.height(14.dp))
            Text(t("Text size", "अक्षर का आकार"), style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(8.dp))
            Choice(listOf("A" to 0, "A+" to 1, "A++" to 2), UiPrefs.textSize) { UiPrefs.updateTextSize(it) }
        }

        Eyebrow(t("About", "जानकारी"))
        CwCard {
            InfoRow(t("App", "ऐप"), t(flavor.serviceEn, flavor.serviceHi))
            InfoRow(t("Version", "संस्करण"), BuildConfig.VERSION_NAME + if (BuildConfig.DEBUG) " (debug)" else "")
            InfoRow(t("Server", "सर्वर"), Http.baseUrl.removePrefix("https://").removePrefix("http://"))
        }

        SecondaryButton(t("Sign out", "साइन आउट"), { confirm = true }, Modifier.fillMaxWidth(), icon = Lucide.LogOut, color = Cw.critical)
        Spacer(Modifier.height(12.dp))
    }

    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text(t("Sign out?", "साइन आउट करें?")) },
            text = { Text(t("Saved screens on this phone are erased too.", "इस फ़ोन पर सहेजा डेटा भी मिट जाएगा।")) },
            confirmButton = {
                TextButton(onClick = {
                    confirm = false
                    scope.launch { Session.logout() }
                }) { Text(t("Sign out", "साइन आउट"), color = Cw.critical, fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text(t("Cancel", "रद्द करें"), color = Cw.ink) } },
            shape = RoundedCornerShape(4.dp),
            containerColor = Cw.card,
        )
    }
}

@Composable
private fun <T> Choice(options: List<Pair<String, T>>, selected: T, onSelect: (T) -> Unit) {
    Row(Modifier.fillMaxWidth().border(1.dp, Cw.border, RoundedCornerShape(3.dp))) {
        options.forEach { (label, value) ->
            val on = value == selected
            Box(
                Modifier
                    .weight(1f)
                    .background(if (on) Cw.govNavy else Color.Transparent)
                    .clickable { onSelect(value) }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, color = if (on) Color.White else Cw.ink, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

@Composable
fun roleWord(platformRole: String) = when (platformRole) {
    "ADMIN" -> t("Platform admin", "प्लेटफ़ॉर्म एडमिन")
    "MERCHANT" -> t("Shop", "दुकान")
    else -> t("Household", "घर")
}

@Composable
fun memberRole(role: String) = when (role) {
    "OWNER" -> t("Owner", "मालिक")
    "MEMBER" -> t("Family", "परिवार")
    else -> t("View only", "सिर्फ़ देखें")
}
