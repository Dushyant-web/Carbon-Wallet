package app.carbonwallet.ghar

import android.app.Activity
import android.net.Uri
import android.view.WindowManager
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.LocalNav
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.Barcode
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.ChoiceChips
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.ListRow
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.Seal
import app.carbonwallet.core.ui.SecondaryButton
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.ago
import app.carbonwallet.core.ui.formatCardCode
import app.carbonwallet.core.ui.kgNumber
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import app.carbonwallet.core.ui.theme.Fonts
import coil3.compose.AsyncImage
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

@Composable
fun CardTab(nav: Nav) = WithHome { home ->
    val passbook = rememberRemote(homePath(home.id, "passbook"), Passbook.serializer())
    val appliances = rememberRemote(homePath(home.id, "appliances"), AppliancesResponse.serializer())
    val vehicles = rememberRemote(homePath(home.id, "vehicles"), VehiclesResponse.serializer())
    val removals = rememberRemote(homePath(home.id, "removals"), RemovalsResponse.serializer())
    val lang = LocalLang.current
    BrightWhileVisible()

    RemoteList(passbook) { pb ->
        item(key = "card") { CarbonCard(pb) }
        item(key = "cardHint") {
            Text(
                t(
                    "Show this at a registered shop. They scan it to add what you buy, and tell you the government benefits you can get.",
                    "पंजीकृत दुकान पर यह दिखाएँ। वे इसे स्कैन करके आपकी ख़रीद जोड़ते हैं और आपको मिलने वाली सरकारी योजनाएँ बताते हैं।",
                ),
                style = MaterialTheme.typography.bodySmall,
                color = Cw.inkMuted,
            )
        }

        val pending = removals.data?.requests.orEmpty().filter { it.status == "PENDING" }.mapNotNull { it.itemId }.toSet()
        val apps = appliances.data?.appliances.orEmpty()
        item(key = "appTitle") { SectionHeader(t("Appliances", "उपकरण"), t("${apps.size} at home", "घर में ${apps.size}")) }
        if (apps.isEmpty()) item { Text(t("No appliances yet. Shops add them when you buy.", "अभी कोई उपकरण नहीं। ख़रीदने पर दुकान जोड़ देगी।"), color = Cw.inkMuted) }
        items(apps, key = { "a-" + it.id }) { a ->
            CwCard(padding = 12.dp) {
                ListRow(
                    a.name,
                    subtitle = listOfNotNull(
                        a.rating?.let { ratingWords(it) },
                        a.powerKw?.let { "${kgNumber(it)} kW" },
                        a.avgHoursPerDay?.let { t("${kgNumber(it)} h a day", "दिन में ${kgNumber(it)} घंटे") },
                    ).joinToString(" · "),
                    icon = applianceIcon(a.type),
                    iconBg = Cw.terracottaSoft,
                    iconTint = Cw.terracotta,
                    onClick = if (home.isOwner && a.id !in pending) {
                        { nav.push("Remove an item", "सामान हटाएँ") { RemovalRequest(home, "APPLIANCE", a.id, a.name, a.source == "MERCHANT") } }
                    } else null,
                    trailing = when {
                        a.id in pending -> { { Tag(t("Removal asked", "हटाने का अनुरोध"), color = Cw.warningText, background = Cw.warningSoft) } }
                        a.source == "MERCHANT" -> { { Tag(t("From shop", "दुकान से"), color = Cw.govNavy, background = Cw.govSky) } }
                        else -> null
                    },
                )
            }
        }

        val cars = vehicles.data?.vehicles.orEmpty()
        if (cars.isNotEmpty()) {
            item(key = "vehTitle") { SectionHeader(t("Vehicles", "गाड़ियाँ")) }
            items(cars, key = { "v-" + it.id }) { v ->
                CwCard(padding = 12.dp) {
                    ListRow(
                        v.name,
                        subtitle = listOfNotNull(
                            v.fuel,
                            v.monthlyKm?.let { t("${it.toInt()} km a month", "महीने में ${it.toInt()} किमी") },
                            v.kmPerUnit?.let { t("${kgNumber(it)} km per litre", "${kgNumber(it)} किमी प्रति लीटर") },
                            v.registrationNo,
                        ).joinToString(" · "),
                        icon = Lucide.Car,
                        iconBg = Cw.govSky,
                        iconTint = Cw.vizTransport,
                        onClick = if (home.isOwner && v.id !in pending) {
                            { nav.push("Remove an item", "सामान हटाएँ") { RemovalRequest(home, "VEHICLE", v.id, v.name, v.source == "MERCHANT") } }
                        } else null,
                        trailing = if (v.id in pending) { { Tag(t("Removal asked", "हटाने का अनुरोध"), color = Cw.warningText, background = Cw.warningSoft) } } else null,
                    )
                }
            }
        }

        val requests = removals.data?.requests.orEmpty()
        if (requests.isNotEmpty()) {
            item(key = "remTitle") { SectionHeader(t("Removal requests", "हटाने के अनुरोध"), t("An admin checks each one", "हर अनुरोध एडमिन जाँचते हैं")) }
            items(requests, key = { "r-" + it.id }) { r ->
                CwCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(r.itemSummary, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        when (r.status) {
                            "APPROVED" -> StatusPill(Tone.GOOD, t("Removed", "हटाया गया"))
                            "REJECTED" -> StatusPill(Tone.BAD, t("Not removed", "नहीं हटाया"))
                            else -> StatusPill(Tone.WARN, t("Waiting", "इंतज़ार"))
                        }
                    }
                    Text("${reasonWords(r.reason)} · ${ago(r.createdAt, lang)}", style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                    r.decisionNote?.takeIf { it.isNotBlank() }?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(t("Admin: $it", "एडमिन: $it"), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        if (home.isOwner && (apps.isNotEmpty() || cars.isNotEmpty())) {
            item(key = "remHint") {
                Text(
                    t("Sold or broken something? Tap it to ask for its removal.", "कुछ बेच दिया या ख़राब हो गया? उसे हटाने के लिए उस पर टैप करें।"),
                    style = MaterialTheme.typography.bodySmall,
                    color = Cw.inkMuted,
                )
            }
        }
    }
}

/** The card a shop scans: navy front with the seal, Carbon ID and the private barcode. */
@Composable
private fun CarbonCard(pb: Passbook) {
    var hidden by rememberSaveable { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.linearGradient(listOf(Cw.govNavy, Cw.govDeep)))
            .border(1.dp, Cw.govNavy, shape),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Seal(48.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("CARBON CARD · कार्बन कार्ड", color = Cw.saffron, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
                Text(pb.household?.name ?: "", color = Color.White, style = MaterialTheme.typography.titleLarge.copy(fontFamily = Fonts.newsreader))
                Text(listOfNotNull(pb.household?.city, pb.household?.state).joinToString(", "), color = Color.White.copy(alpha = 0.75f), style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Text(t("Carbon ID", "कार्बन आईडी"), color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                Text(pb.carbonId ?: "—", color = Color.White, style = MaterialTheme.typography.titleMedium.copy(fontFamily = Fonts.mono))
            }
            pb.current?.let {
                Column(horizontalAlignment = Alignment.End) {
                    Text(it.label ?: "", color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                    Text("${kgNumber(it.totalKg)} kg", color = Color.White, style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Box(Modifier.fillMaxWidth().height(3.dp).background(Cw.saffron))
        val code = pb.cardCode
        Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 18.dp, vertical = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (code == null) {
                Text(t("Card code not available", "कार्ड कोड उपलब्ध नहीं"), color = Cw.inkMuted)
            } else if (hidden) {
                Box(Modifier.fillMaxWidth().height(72.dp).background(Cw.subtle).clickable { hidden = false }, contentAlignment = Alignment.Center) {
                    Text(t("Tap to show the barcode", "बारकोड देखने के लिए टैप करें"), color = Cw.inkMuted)
                }
            } else {
                Barcode(code, height = 72.dp)
                Spacer(Modifier.height(6.dp))
                Text(formatCardCode(code), style = MaterialTheme.typography.titleSmall.copy(fontFamily = Fonts.mono), letterSpacing = 2.sp)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                if (hidden) t("Show", "दिखाएँ") else t("Hide · keep this code private", "छिपाएँ · यह कोड किसी को न भेजें"),
                color = Cw.govBlue,
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.clickable { hidden = !hidden }.padding(4.dp),
            )
        }
    }
}

/** Shops scan from a phone screen more easily at full brightness; restored when leaving the tab. */
@Composable
private fun BrightWhileVisible() {
    val activity: Activity? = LocalActivity.current
    DisposableEffect(activity) {
        val window = activity?.window ?: return@DisposableEffect onDispose {}
        val before = window.attributes.screenBrightness
        window.attributes = window.attributes.apply { screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL }
        onDispose { window.attributes = window.attributes.apply { screenBrightness = before } }
    }
}

private val REASONS = listOf("BROKEN", "SOLD", "GIVEN_AWAY", "SCRAPPED", "NEVER_HAD", "NOT_OURS")

@Composable
private fun reasonWords(reason: String) = when (reason) {
    "BROKEN" -> t("Broken", "ख़राब हो गया")
    "SOLD" -> t("Sold", "बेच दिया")
    "GIVEN_AWAY" -> t("Given away", "किसी को दे दिया")
    "SCRAPPED" -> t("Scrapped", "कबाड़ में दिया")
    "NEVER_HAD" -> t("Never had it", "कभी था ही नहीं")
    "NOT_OURS" -> t("Not ours (shop's mistake)", "हमारा नहीं (दुकान की ग़लती)")
    else -> reason
}

/**
 * Items can't simply be deleted: the owner asks, with up to three photos and about two lines,
 * and an admin decides. "Not ours" on a shop's item also counts against that shop.
 */
@Composable
private fun RemovalRequest(home: ActiveHome, kind: String, itemId: String, name: String, fromShop: Boolean) {
    val context = LocalContext.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var reason by rememberSaveable { mutableStateOf<String?>(null) }
    var note by rememberSaveable { mutableStateOf("") }
    val photos = remember { mutableStateListOf<Uri>() }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(3)) { uris ->
        photos.clear()
        photos.addAll(uris.take(3))
    }
    val needsPhoto = reason != null && reason !in setOf("NEVER_HAD", "NOT_OURS")
    val reasons = REASONS.filter { it != "NOT_OURS" || fromShop }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        CwCard(background = Cw.subtle) {
            Eyebrow(t("Item", "सामान"))
            Text(name, style = MaterialTheme.typography.titleLarge)
        }
        Text(t("What happened?", "क्या हुआ?"), style = MaterialTheme.typography.titleMedium)
        ChoiceChips(reasons.map { reasonWords(it) to it }, reason, { reason = it })
        CwTextField(note, { note = it.take(240) }, t("A line or two (optional)", "एक-दो लाइन (ज़रूरी नहीं)"), singleLine = false, minLines = 2, supporting = "${note.length}/240")
        if (needsPhoto) {
            Text(t("Photos (up to 3)", "फ़ोटो (3 तक)"), style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                photos.forEach { uri ->
                    AsyncImage(uri, null, Modifier.size(84.dp).clip(CardShape), contentScale = ContentScale.Crop)
                }
                if (photos.size < 3) {
                    Box(
                        Modifier.size(84.dp).border(1.dp, Cw.border, CardShape).background(Color.White, CardShape)
                            .clickable { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        contentAlignment = Alignment.Center,
                    ) { Icon(Lucide.Plus, t("Add photos", "फ़ोटो जोड़ें"), tint = Cw.inkMuted) }
                }
            }
        }
        error?.let { Banner(Tone.BAD, it) }
        PrimaryButton(t("Send to admin", "एडमिन को भेजें"), {
            val r = reason ?: run { error = "Pick what happened."; return@PrimaryButton }
            if (needsPhoto && photos.isEmpty()) { error = "Add at least one photo."; return@PrimaryButton }
            busy = true
            error = null
            scope.launch {
                try {
                    val files = coroutineScope { photos.map { async { Photos.prepare(context, it) } }.awaitAll() }
                    val form = MultipartBody.Builder().setType(MultipartBody.FORM)
                        .addFormDataPart("kind", kind)
                        .addFormDataPart("itemId", itemId)
                        .addFormDataPart("reason", r)
                        .addFormDataPart("note", note.trim())
                        .apply { files.forEach { f -> addFormDataPart("photos", f.name, f.bytes.toRequestBody(f.mime.toMediaType())) } }
                        .build()
                    Http.upload(homePath(home.id, "removals"), form)
                    Store.changed()
                    nav.pop()
                    nav.toast("Sent. An admin will check it.")
                } catch (e: Exception) {
                    error = e.message
                }
                busy = false
            }
        }, Modifier.fillMaxWidth(), icon = Lucide.Upload, busy = busy, color = Cw.govNavy)
        SecondaryButton(t("Cancel", "रद्द करें"), { nav.pop() }, Modifier.fillMaxWidth())
        Text(
            t("The item keeps counting until an admin approves.", "एडमिन की मंज़ूरी तक सामान गिना जाता रहेगा।"),
            style = MaterialTheme.typography.bodySmall,
            color = Cw.inkMuted,
        )
    }
}

@Composable
private fun ratingWords(r: String) = when (r) {
    "5_STAR_INVERTER" -> t("5-star inverter", "5-स्टार इन्वर्टर")
    "5_STAR" -> t("5-star", "5-स्टार")
    "4_STAR" -> t("4-star", "4-स्टार")
    "3_STAR" -> t("3-star", "3-स्टार")
    "2_STAR" -> t("2-star", "2-स्टार")
    "1_STAR" -> t("1-star", "1-स्टार")
    "UNRATED", "NONE" -> t("No star label", "स्टार लेबल नहीं")
    else -> r.replace('_', ' ').lowercase()
}

private fun applianceIcon(type: String): ImageVector = when (type.uppercase()) {
    "AC", "COOLER", "FAN" -> Lucide.Wind
    "GEYSER", "WATER_HEATER" -> Lucide.Droplets
    "FRIDGE", "REFRIGERATOR" -> Lucide.Package
    else -> Lucide.Zap
}
