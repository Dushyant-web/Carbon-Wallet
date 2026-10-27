package app.carbonwallet.core.shell

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.carbonwallet.BuildConfig
import app.carbonwallet.core.FlavorSpec
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.Seal
import app.carbonwallet.core.ui.SecondaryButton
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.Tricolour
import app.carbonwallet.core.ui.UtilityBar
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import app.carbonwallet.core.ui.theme.Fonts
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(flavor: FlavorSpec) {
    val scope = rememberCoroutineScope()
    val activity = LocalActivity.current
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }

    fun signIn() {
        if (busy) return
        if (email.isBlank() || password.isBlank()) {
            error = "Enter your email and password."
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                Session.login(email, password)
            } catch (e: Exception) {
                error = e.message
            }
            busy = false
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Cw.canvas)
            .verticalScroll(rememberScrollState())
            .imePadding(),
    ) {
        // portal masthead, full width
        Column(Modifier.fillMaxWidth().background(Cw.govDeep).windowInsetsPadding(WindowInsets.statusBars)) {
            Tricolour()
            UtilityBar()
            Column(
                Modifier.fillMaxWidth().background(Cw.govNavy).padding(top = 28.dp, bottom = 26.dp, start = 20.dp, end = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Seal(108.dp)
                Spacer(Modifier.height(16.dp))
                Text("कार्बन वॉलेट", color = Color.White, style = MaterialTheme.typography.headlineSmall.copy(fontFamily = Fonts.plexDeva))
                Text("Carbon Wallet", color = Color.White, style = MaterialTheme.typography.headlineMedium.copy(fontFamily = Fonts.newsreader))
                Spacer(Modifier.height(6.dp))
                Text(
                    t(flavor.serviceEn, flavor.serviceHi),
                    color = Color.White.copy(alpha = 0.8f),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                )
            }
            Box(Modifier.fillMaxWidth().height(4.dp).background(Cw.saffron))
        }

        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Eyebrow(t("Sign in", "साइन इन"))
            Text(t("Welcome back", "फिर से स्वागत है"), style = MaterialTheme.typography.headlineMedium)

            Session.notice?.let { Banner(Tone.WARN, it) }
            error?.let { Banner(Tone.BAD, it) }

            CwTextField(email, { email = it.trim(); error = null }, t("Email", "ईमेल"), icon = Lucide.Mail, keyboardType = KeyboardType.Email)
            CwTextField(
                password,
                { password = it; error = null },
                t("Password", "पासवर्ड"),
                icon = Lucide.Lock,
                keyboardType = KeyboardType.Password,
                password = !showPassword,
                trailing = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(if (showPassword) Lucide.EyeOff else Lucide.Eye, t("Show password", "पासवर्ड दिखाएँ"), modifier = Modifier.size(18.dp))
                    }
                },
            )
            PrimaryButton(t("Sign in", "साइन इन करें"), ::signIn, Modifier.fillMaxWidth(), busy = busy, color = Cw.govNavy)

            val google = flavor.googleIdToken
            if (google != null && BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank() && activity != null) {
                SecondaryButton(
                    t("Continue with Google", "Google से जारी रखें"),
                    onClick = {
                        busy = true
                        error = null
                        scope.launch {
                            try {
                                Session.loginWithGoogle(google(activity), flavor.googleRole ?: "household")
                            } catch (e: Exception) {
                                error = e.message
                            }
                            busy = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    icon = Lucide.Globe,
                    enabled = !busy,
                )
            }

            if ((BuildConfig.DEBUG || BuildConfig.SHOW_DEMO) && flavor.demoAccounts.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Eyebrow(t("Demo accounts", "डेमो खाते"))
                flavor.demoAccounts.forEach { demo ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .background(Cw.card, RoundedCornerShape(3.dp))
                            .border(1.dp, Cw.border, RoundedCornerShape(3.dp))
                            .clickable {
                                email = demo.email
                                password = demo.password
                                error = null
                            }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Lucide.User, null, tint = Cw.inkMuted, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(demo.label, style = MaterialTheme.typography.titleSmall)
                            Text(demo.email, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                        }
                        Text(t("Fill", "भरें"), color = Cw.govBlue, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Text(
                t(
                    "A citizen carbon service. Not a government website or app.",
                    "नागरिकों के लिए कार्बन सेवा। यह सरकारी वेबसाइट या ऐप नहीं है।",
                ),
                style = MaterialTheme.typography.bodySmall,
                color = Cw.inkMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            if (BuildConfig.DEBUG) {
                Text("Server: ${Http.baseUrl}", style = MaterialTheme.typography.labelSmall, color = Cw.inkLight, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            Spacer(Modifier.windowInsetsPadding(WindowInsets.navigationBars))
        }
    }
}
