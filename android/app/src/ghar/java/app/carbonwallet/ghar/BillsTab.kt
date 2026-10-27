package app.carbonwallet.ghar

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.Column1
import app.carbonwallet.core.ui.ColumnChart
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.DateField
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.SecondaryButton
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.ago
import app.carbonwallet.core.ui.kg
import app.carbonwallet.core.ui.kgNumber
import app.carbonwallet.core.ui.rupees
import app.carbonwallet.core.ui.shortDate
import app.carbonwallet.core.ui.date
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import app.carbonwallet.core.ui.LocalLang
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import kotlin.math.roundToInt

@Composable
fun BillsTab(nav: Nav) = WithHome { home ->
    val remote = rememberRemote(homePath(home.id, "bills"), BillsResponse.serializer())
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var allowAi by rememberSaveable { mutableStateOf(false) }
    var uploading by remember { mutableStateOf(false) }
    var captureUri by rememberSaveable { mutableStateOf<String?>(null) }
    val lang = LocalLang.current

    fun upload(uri: Uri) {
        uploading = true
        scope.launch {
            try {
                val file = Photos.prepare(context, uri)
                val form = MultipartBody.Builder().setType(MultipartBody.FORM)
                    .addFormDataPart("file", file.name, file.bytes.toRequestBody(file.mime.toMediaType()))
                    .apply { if (allowAi) addFormDataPart("allowAi", "1") }
                    .build()
                val text = Http.upload(homePath(home.id, "bills/upload"), form)
                val doc = Http.json.decodeFromString(UploadResponse.serializer(), text).document
                Store.changed()
                nav.push("Check the bill", "बिल जाँचें") { BillReview(home, doc) }
            } catch (e: Exception) {
                nav.toast(e.message ?: "Upload failed.")
            }
            uploading = false
        }
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = captureUri
        if (ok && uri != null) upload(Uri.parse(uri))
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) upload(uri) }

    RemoteList(remote) { data ->
        if (home.canAddBills) {
            item(key = "add") {
                CwCard(padding = 18.dp) {
                    Eyebrow(t("Add this month's bill", "इस महीने का बिल जोड़ें"))
                    Spacer(Modifier.height(4.dp))
                    Text(t("Take a photo of the bill. We read the units for you.", "बिल की फ़ोटो लें। यूनिट हम पढ़ लेंगे।"), style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(14.dp))
                    if (uploading) {
                        Row(Modifier.fillMaxWidth().background(Cw.govSky, CardShape).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(Modifier.size(20.dp), color = Cw.govNavy, strokeWidth = 2.dp)
                            Spacer(Modifier.width(12.dp))
                            Text(t("Reading your bill… this takes a few seconds.", "बिल पढ़ रहे हैं… कुछ सेकंड लगेंगे।"), style = MaterialTheme.typography.bodyMedium, color = Cw.govNavy)
                        }
                    } else {
                        PrimaryButton(t("Take bill photo", "बिल की फ़ोटो लें"), {
                            val uri = Photos.newCaptureUri(context)
                            captureUri = uri.toString()
                            camera.launch(uri)
                        }, Modifier.fillMaxWidth(), icon = Lucide.Camera, color = Cw.govNavy)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SecondaryButton(t("Photo or PDF", "फ़ोटो या PDF"), { picker.launch(arrayOf("image/*", "application/pdf")) }, Modifier.weight(1f), icon = Lucide.Upload)
                            SecondaryButton(t("Type it in", "ख़ुद लिखें"), {
                                nav.push("Add a bill", "बिल जोड़ें") { BillReview(home, null) }
                            }, Modifier.weight(1f), icon = Lucide.Pencil)
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth().clickable { allowAi = !allowAi }, verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(allowAi, { allowAi = it }, colors = CheckboxDefaults.colors(checkedColor = Cw.govNavy))
                        Text(
                            t("If our reader isn't sure, let an AI service read the photo too.", "अगर हमें पक्का न हो, तो AI सेवा से भी फ़ोटो पढ़वाएँ।"),
                            style = MaterialTheme.typography.bodySmall,
                            color = Cw.inkMuted,
                        )
                    }
                }
            }
        }

        if (data.pending.isNotEmpty()) {
            item(key = "pendingTitle") { SectionHeader(t("Waiting for you to check", "आपकी जाँच बाकी")) }
            items(data.pending, key = { "p-" + it.id }) { doc ->
                CwCard(onClick = { nav.push("Check the bill", "बिल जाँचें") { BillReview(home, doc) } }, border = Cw.warningBorder, background = Cw.warningSoft) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Lucide.FileCheck, null, tint = Cw.warningText, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(doc.fileName.ifBlank { t("Bill photo", "बिल फ़ोटो") }, style = MaterialTheme.typography.titleSmall)
                            Text(ago(doc.createdAt, lang), style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                        }
                        Text(t("Check", "जाँचें"), color = Cw.govBlue, style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }

        val bills = data.bills.sortedBy { it.periodEnd }
        if (bills.isNotEmpty()) {
            item(key = "chart") {
                CwCard {
                    Eyebrow(t("Units per bill", "हर बिल की यूनिट"))
                    Text(t("Electricity used, bill by bill", "हर बिल में बिजली की खपत"), style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(12.dp))
                    ColumnChart(
                        bills.takeLast(6).mapIndexed { i, b -> Column1(shortDate(b.periodEnd), b.kwh, highlight = i == bills.takeLast(6).lastIndex) },
                        valueText = { "${it.roundToInt()}" },
                        highlightColor = Cw.vizElectricity,
                        description = "Units per bill",
                    )
                }
            }
        }

        data.calibration?.acKw?.let { ac ->
            item(key = "ac") {
                CwCard(background = Cw.govSky, border = Cw.govSky) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Lucide.Thermometer, null, tint = Cw.govNavy, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(t("Your AC really draws about ${kgNumber(ac)} kW", "आपका AC असल में लगभग ${kgNumber(ac)} kW लेता है"), style = MaterialTheme.typography.titleSmall)
                            Text(
                                t("Worked out from ${data.calibration.nBills} bills and the weather on those days.", "${data.calibration.nBills} बिलों और उन दिनों के मौसम से निकाला गया।"),
                                style = MaterialTheme.typography.bodySmall,
                                color = Cw.inkMuted,
                            )
                        }
                    }
                }
            }
        }

        item(key = "listTitle") { SectionHeader(t("Past bills", "पिछले बिल"), t("${data.bills.size} bills", "${data.bills.size} बिल")) }
        if (data.bills.isEmpty()) {
            item { EmptyState(Lucide.Receipt, t("No bills yet", "अभी कोई बिल नहीं"), t("Your first bill sets up this month's numbers.", "पहला बिल जोड़ते ही इस महीने के आँकड़े बनेंगे।")) }
        }
        items(data.bills.sortedByDescending { it.periodEnd }, key = { it.id }) { BillRow(it) }
    }
}

@Composable
private fun BillRow(b: Bill) {
    CwCard {
        Row(verticalAlignment = Alignment.Top) {
            Box(Modifier.size(40.dp).background(Cw.terracottaSoft, CardShape), contentAlignment = Alignment.Center) {
                Icon(Lucide.Zap, null, tint = Cw.terracotta, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("${shortDate(b.periodStart)} – ${date(b.periodEnd)}", style = MaterialTheme.typography.titleSmall)
                Text(
                    listOfNotNull(t("${b.days} days", "${b.days} दिन"), b.amountInr?.let { rupees(it) }, "${kg(b.kgCo2e)} CO₂e").joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = Cw.inkMuted,
                )
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    b.discom?.takeIf { it.isNotBlank() && it != "Unknown discom" }?.let { Tag(it) }
                    b.consumerMasked?.let { Tag(it) }
                    if (b.source == "MANUAL") Tag(t("Typed in", "हाथ से लिखा"))
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("${b.kwh.roundToInt()}", style = MaterialTheme.typography.headlineSmall)
                Text(t("units", "यूनिट"), style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
            }
        }
    }
}

/** Shows what the server read from the bill; the family corrects anything wrong, then confirms. */
@Composable
fun BillReview(home: ActiveHome, doc: BillDocument?) {
    val fields = doc?.extraction?.fields
    var units by rememberSaveable { mutableStateOf(fields?.unitsKwh?.value?.let { kgNumber(it).replace(",", "") } ?: "") }
    var amount by rememberSaveable { mutableStateOf(fields?.amountInr?.value?.roundToInt()?.toString() ?: "") }
    var start by rememberSaveable { mutableStateOf(fields?.periodStart?.value?.take(10) ?: "") }
    var end by rememberSaveable { mutableStateOf(fields?.periodEnd?.value?.take(10) ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val nav = app.carbonwallet.core.shell.LocalNav.current

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (doc != null) {
            val ex = doc.extraction
            val sure = ex?.status == "ok"
            Banner(
                if (sure) Tone.GOOD else Tone.WARN,
                if (sure) t("We read this bill. Check the numbers and confirm.", "हमने बिल पढ़ लिया। आँकड़े देखकर पक्का करें।")
                else t("Some numbers weren't clear. Please check each one against the bill.", "कुछ आँकड़े साफ़ नहीं थे। बिल से मिलाकर ठीक करें।"),
            )
            ex?.discom?.name?.takeIf { it.isNotBlank() }?.let { Tag(t("Electricity company: $it", "बिजली कंपनी: $it")) }
        } else {
            Text(t("Copy these from your bill.", "ये आँकड़े अपने बिल से लिखें।"), style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted)
        }
        error?.let { Banner(Tone.BAD, it) }

        CwTextField(units, { units = it.filter { c -> c.isDigit() || c == '.' } }, t("Units used (kWh)", "इस्तेमाल हुई यूनिट (kWh)"), icon = Lucide.Zap, keyboardType = KeyboardType.Decimal,
            trailing = fields?.unitsKwh?.let { { Confidence(it.confidence) } })
        CwTextField(amount, { amount = it.filter { c -> c.isDigit() || c == '.' } }, t("Bill amount (₹)", "बिल की रकम (₹)"), icon = Lucide.Rupee, keyboardType = KeyboardType.Decimal,
            trailing = fields?.amountInr?.let { { Confidence(it.confidence) } })
        DateField(t("Bill from", "बिल की शुरुआत"), start, { start = it })
        DateField(t("Bill to", "बिल का अंत"), end, { end = it })

        PrimaryButton(t("Confirm bill", "बिल पक्का करें"), {
            val kwh = units.toDoubleOrNull()
            if (kwh == null || kwh <= 0 || start.isBlank() || end.isBlank()) {
                error = "Fill in the units and both dates."
                return@PrimaryButton
            }
            busy = true
            error = null
            scope.launch {
                try {
                    Http.sendText("POST", homePath(home.id, "bills"), buildJsonObject {
                        doc?.let { put("documentId", it.id) }
                        put("periodStart", start)
                        put("periodEnd", end)
                        put("kwh", kwh)
                        amount.toDoubleOrNull()?.let { put("amountInr", it) }
                    })
                    Store.changed()
                    nav.pop()
                    nav.toast("Bill saved. Your numbers are updated.")
                } catch (e: Exception) {
                    error = e.message
                }
                busy = false
            }
        }, Modifier.fillMaxWidth(), icon = Lucide.Check, busy = busy, color = Cw.moss)
        Text(
            t("Only the numbers are kept. The consumer number is stored masked.", "सिर्फ़ आँकड़े रखे जाते हैं। उपभोक्ता नंबर छिपाकर रखा जाता है।"),
            style = MaterialTheme.typography.bodySmall,
            color = Cw.inkMuted,
        )
    }
}

@Composable
private fun Confidence(level: String) {
    when (level) {
        "high" -> StatusPill(Tone.GOOD, t("Sure", "पक्का"), Modifier.padding(end = 8.dp))
        "medium" -> StatusPill(Tone.WARN, t("Check", "जाँचें"), Modifier.padding(end = 8.dp))
        else -> StatusPill(Tone.BAD, t("Unsure", "पक्का नहीं"), Modifier.padding(end = 8.dp))
    }
}
