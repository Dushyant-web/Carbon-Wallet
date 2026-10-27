package app.carbonwallet.dukaan

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.SecondaryButton
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import app.carbonwallet.core.ui.theme.Fonts
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

/**
 * The customer in front of the counter. Kept outside the screen so switching tabs mid-sale keeps it,
 * and dropped when another account signs in.
 */
object CounterSession {
    private var owner: String? = null
    var current by mutableStateOf<ScanResult?>(null)
    val registered = mutableStateListOf<String>()
    val helped = mutableStateMapOf<String, String>()

    fun check() {
        val id = Session.me?.user?.id
        if (id != owner) {
            owner = id
            clear()
        }
    }

    fun start(scan: ScanResult) {
        current = scan
        registered.clear()
        helped.clear()
    }

    fun clear() {
        current = null
        registered.clear()
        helped.clear()
    }
}

@Composable
fun CounterTab(nav: Nav) {
    CounterSession.check()
    val scan = CounterSession.current
    if (scan == null) ScanScreen() else CustomerScreen(nav, scan)
}

@Composable
private fun ScanScreen() {
    val context = LocalContext.current
    val activity = LocalActivity.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var granted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    var torch by rememberSaveable { mutableStateOf(false) }
    var cameraBroken by remember { mutableStateOf(false) }
    var code by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var last by remember { mutableStateOf("") }
    var lastAt by remember { mutableLongStateOf(0L) }

    fun check(input: String) {
        val value = input.trim()
        val now = System.currentTimeMillis()
        // the camera reads the same barcode many times a second: act on it once
        if (busy || value.length < 4 || (value == last && now - lastAt < 4000)) return
        last = value
        lastAt = now
        busy = true
        error = null
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        scope.launch {
            try {
                val result = Http.send("POST", "/api/merchant/scan", buildJsonObject { put("input", value) }, ScanResult.serializer())
                CounterSession.start(result)
                code = ""
            } catch (e: Exception) {
                error = e.message
            }
            busy = false
        }
    }

    NfcCardReader(enabled = !busy) { check(it) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Column {
            Eyebrow(t("Counter", "काउंटर"))
            Text(t("Scan the customer's Carbon Card", "ग्राहक का कार्बन कार्ड स्कैन करें"), style = MaterialTheme.typography.headlineSmall)
        }

        Box(Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(6.dp)).background(Cw.govDeep), contentAlignment = Alignment.Center) {
            if (granted && cameraBroken) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(20.dp)) {
                    Icon(Lucide.Camera, null, tint = Color.White, modifier = Modifier.size(36.dp))
                    Spacer(Modifier.height(10.dp))
                    Text(
                        t("The camera scanner couldn't start on this phone. Type the code below instead.", "इस फ़ोन पर कैमरा स्कैनर शुरू नहीं हुआ। नीचे कोड लिखें।"),
                        color = Color.White,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            } else if (granted) {
                BarcodeScanner(onCode = { check(it) }, torch = torch, modifier = Modifier.fillMaxSize(), onUnavailable = { cameraBroken = true })
                ScanFrame()
                Row(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("Hold the barcode inside the frame", "बारकोड को फ़्रेम के अंदर रखें"), color = Color.White, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                    Box(
                        Modifier.size(40.dp).background(if (torch) Cw.saffron else Color.White.copy(alpha = 0.15f), CircleShape).clickable { torch = !torch },
                        contentAlignment = Alignment.Center,
                    ) { Icon(Lucide.Flashlight, t("Torch", "टॉर्च"), tint = Color.White, modifier = Modifier.size(20.dp)) }
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(20.dp)) {
                    Icon(Lucide.Camera, null, tint = Color.White, modifier = Modifier.size(36.dp))
                    Spacer(Modifier.height(10.dp))
                    Text(t("Use the camera to read cards", "कार्ड पढ़ने के लिए कैमरा चालू करें"), color = Color.White, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(12.dp))
                    PrimaryButton(t("Allow camera", "कैमरा की अनुमति दें"), { ask.launch(Manifest.permission.CAMERA) }, color = Cw.saffron)
                }
            }
            if (busy) {
                Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
                        Spacer(Modifier.height(10.dp))
                        Text(t("Checking the card…", "कार्ड जाँच रहे हैं…"), color = Color.White)
                    }
                }
            }
        }

        error?.let { Banner(Tone.BAD, it) }

        if (nfcAvailable(activity)) {
            Row(Modifier.fillMaxWidth().background(Cw.govSky, CardShape).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Lucide.Nfc, null, tint = Cw.govNavy, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(t("Or tap the card on the back of this phone.", "या कार्ड को फ़ोन के पीछे छुआएँ।"), style = MaterialTheme.typography.bodyMedium, color = Cw.govNavy)
            }
        }

        CwCard {
            Text(t("Card won't scan? Type the code under the barcode", "कार्ड स्कैन नहीं हो रहा? बारकोड के नीचे का कोड लिखें"), style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(10.dp))
            CwTextField(code, { code = it.uppercase().take(20) }, "CW1-XXXX-XXXX-XXXX", icon = Lucide.Keyboard)
            Spacer(Modifier.height(10.dp))
            PrimaryButton(t("Check card", "कार्ड जाँचें"), { check(code) }, Modifier.fillMaxWidth(), icon = Lucide.Search, enabled = code.length >= 10, busy = busy, color = Cw.govNavy)
        }

        Text(
            t(
                "You'll see the home's colour and the government benefits that fit what you sell. Never their bills or numbers.",
                "आपको घर का रंग और आपके सामान से जुड़ी सरकारी योजनाएँ दिखेंगी। उनके बिल या आँकड़े कभी नहीं।",
            ),
            style = MaterialTheme.typography.bodySmall,
            color = Cw.inkMuted,
        )
    }
}

@Composable
private fun CustomerScreen(nav: Nav, scan: ScanResult) {
    val scope = rememberCoroutineScope()
    val tone = Tone.ofColour(scan.advice.status?.colour)
    val expires = remember(scan.ticket) { runCatching { Instant.parse(scan.expiresAt).toEpochMilli() }.getOrDefault(0L) }
    var left by remember(scan.ticket) { mutableLongStateOf(expires - System.currentTimeMillis()) }
    LaunchedEffect(scan.ticket) {
        while (left > 0) {
            delay(1000)
            left = expires - System.currentTimeMillis()
        }
    }
    val expired = left <= 0

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // the colour, big, with an icon and a word
        Column(Modifier.fillMaxWidth().background(tone.bg, CardShape).padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(56.dp).background(tone.fg, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(tone.icon, null, tint = Color.White, modifier = Modifier.size(30.dp))
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(colourWord(tone), style = MaterialTheme.typography.headlineMedium, color = tone.fg)
                    Text(colourMeaning(tone), style = MaterialTheme.typography.bodySmall, color = tone.fg)
                }
            }
            scan.advice.status?.sentence?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, style = MaterialTheme.typography.bodyLarge, color = Cw.ink)
            }
        }

        CwCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(scan.customer.name, style = MaterialTheme.typography.titleLarge)
                    Text(listOf(scan.customer.city, scan.customer.state).filter { it.isNotBlank() }.joinToString(", "), style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                    scan.customer.carbonId?.let { Text(it, style = MaterialTheme.typography.labelLarge.copy(fontFamily = Fonts.mono), color = Cw.govNavy) }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(t("Scan valid", "स्कैन मान्य"), style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                    Text(
                        if (expired) t("Expired", "समाप्त") else "%d:%02d".format(left / 60000, (left / 1000) % 60),
                        style = MaterialTheme.typography.titleLarge.copy(fontFamily = Fonts.mono),
                        color = if (expired || left < 120_000) Cw.critical else Cw.ink,
                    )
                }
            }
        }

        if (expired) Banner(Tone.WARN, t("This scan has expired. Scan the card again to register more.", "स्कैन की समय सीमा ख़त्म। और जोड़ने के लिए कार्ड फिर स्कैन करें।"))

        PrimaryButton(
            t("Register what they bought", "ख़रीदा सामान जोड़ें"),
            { nav.push("Pick the product", "सामान चुनें") { CataloguePicker(scan) } },
            Modifier.fillMaxWidth(),
            icon = Lucide.Plus,
            enabled = !expired,
            color = Cw.govNavy,
        )

        if (CounterSession.registered.isNotEmpty()) {
            CwCard(background = Cw.successSoft, border = Cw.successBorder) {
                Eyebrow(t("Registered this visit", "इस बार जोड़ा गया"), color = Cw.successText)
                CounterSession.registered.forEach {
                    Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Lucide.Check, null, tint = Cw.successText, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(it, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        if (scan.advice.benefits.isNotEmpty()) {
            SectionHeader(t("Benefits to tell them about", "इन्हें ये योजनाएँ बताएँ"), t("Tap what you did, so the home sees your help", "आपने जो किया उस पर टैप करें, ताकि घर को आपकी मदद दिखे"))
            scan.advice.benefits.forEach { b ->
                val done = CounterSession.helped[b.slug]
                CwCard(border = if (b.matched) Cw.saffron.copy(alpha = 0.5f) else Cw.border) {
                    Row(verticalAlignment = Alignment.Top) {
                        Text(b.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                        if (b.matched) Tag(t("Fits this home", "इस घर के लिए"), color = Cw.warningText, background = Cw.saffronSoft)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(b.benefit, style = MaterialTheme.typography.bodyMedium)
                    b.why?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(it, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                    }
                    b.helpline?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(t("Helpline $it", "हेल्पलाइन $it"), style = MaterialTheme.typography.labelMedium, color = Cw.govNavy, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(10.dp))
                    if (done != null) {
                        StatusPill(Tone.GOOD, if (done == "APPLIED") t("Helped them apply", "आवेदन में मदद की") else t("Explained", "समझाया"))
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("EXPLAINED" to t("I explained it", "मैंने समझाया"), "APPLIED" to t("Helped apply", "आवेदन कराया")).forEach { (status, label) ->
                                SecondaryButton(label, {
                                    scope.launch {
                                        try {
                                            Http.sendText("POST", "/api/merchant/schemes", buildJsonObject {
                                                put("ticket", scan.ticket)
                                                put("slug", b.slug)
                                                put("status", status)
                                            })
                                            CounterSession.helped[b.slug] = status
                                            Store.changed()
                                        } catch (e: Exception) {
                                            nav.toast(e.message ?: "")
                                        }
                                    }
                                }, Modifier.weight(1f), enabled = !expired)
                            }
                        }
                    }
                }
            }
        }

        SecondaryButton(t("Next customer", "अगला ग्राहक"), { CounterSession.clear() }, Modifier.fillMaxWidth(), icon = Lucide.Scan)
    }
}

@Composable
private fun colourWord(tone: Tone) = when (tone) {
    Tone.GOOD -> t("Green", "हरा")
    Tone.WARN -> t("Amber", "पीला")
    Tone.BAD -> t("Red", "लाल")
    else -> t("No colour yet", "अभी रंग नहीं")
}

@Composable
private fun colourMeaning(tone: Tone) = when (tone) {
    Tone.GOOD -> t("Within their allowance (100 kg a person)", "अपनी सीमा के अंदर (100 किलो प्रति व्यक्ति)")
    Tone.WARN -> t("Close to their allowance (100 kg a person)", "अपनी सीमा के पास (100 किलो प्रति व्यक्ति)")
    Tone.BAD -> t("Over their allowance (100 kg a person)", "अपनी सीमा से ज़्यादा (100 किलो प्रति व्यक्ति)")
    else -> t("This home has no bills yet", "इस घर का अभी कोई बिल नहीं")
}
