package app.carbonwallet.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.LocalNav
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.ChoiceChips
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.InfoRow
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.SecondaryButton
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.ago
import app.carbonwallet.core.ui.date
import app.carbonwallet.core.ui.monthLabel
import app.carbonwallet.core.ui.pick
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.math.roundToInt

/** One PATCH with a toast, then every screen reloads. */
private suspend fun patch(nav: Nav, path: String, body: JsonObject, done: String): Boolean = try {
    Http.sendText("PATCH", path, body)
    Store.changed()
    nav.toast(done)
    true
} catch (e: Exception) {
    nav.toast(e.message ?: "Couldn't save.")
    false
}

/** Asks before anything that changes what other people see. */
@Composable
private fun Confirm(title: String, body: String, action: String, danger: Boolean, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(body) },
        confirmButton = { TextButton(onClick = { onDismiss(); onConfirm() }) { Text(action, color = if (danger) Cw.critical else Cw.moss, fontWeight = FontWeight.SemiBold) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(t("Cancel", "रद्द करें"), color = Cw.ink) } },
        shape = RoundedCornerShape(4.dp),
        containerColor = Cw.card,
    )
}

// ---------------------------------------------------------------- shops

@Composable
fun ShopsTab(nav: Nav) {
    val remote = rememberRemote("/api/admin/merchants", MerchantsResponse.serializer())
    val scope = rememberCoroutineScope()
    val lang = LocalLang.current
    var filter by rememberSaveable { mutableStateOf("ALL") }
    var asking by remember { mutableStateOf<Pair<AdminMerchant, String>?>(null) }

    RemoteList(remote) { data ->
        item(key = "filter") {
            Column {
                Eyebrow(t("Shops", "दुकानें"))
                Text(t("Approve shops before they can register items", "सामान दर्ज करने से पहले दुकानों को मंज़ूरी दें"), style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(10.dp))
                ChoiceChips(
                    listOf(t("All", "सभी") to "ALL", t("Waiting", "बाकी") to "PENDING", t("Approved", "मंज़ूर") to "APPROVED", t("Suspended", "निलंबित") to "SUSPENDED"),
                    filter,
                    { filter = it },
                )
            }
        }
        val shown = data.merchants.filter { filter == "ALL" || it.status == filter }.sortedBy { if (it.status == "PENDING") 0 else 1 }
        if (shown.isEmpty()) item { EmptyState(Lucide.Store, t("No shops here", "यहाँ कोई दुकान नहीं")) }
        items(shown, key = { it.id }) { m ->
            CwCard(border = if (m.status == "PENDING") Cw.warningBorder else Cw.border) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(m.businessName, style = MaterialTheme.typography.titleLarge)
                        Text("${m.city}, ${m.state} · ${sells(m.sells)}", style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                    }
                    when (m.status) {
                        "APPROVED" -> StatusPill(Tone.GOOD, t("Approved", "मंज़ूर"))
                        "SUSPENDED" -> StatusPill(Tone.BAD, t("Suspended", "निलंबित"))
                        else -> StatusPill(Tone.WARN, t("Waiting", "बाकी"))
                    }
                }
                Spacer(Modifier.height(8.dp))
                m.contact?.let { InfoRow(t("Contact", "संपर्क"), "${it.name}\n${it.email}") }
                InfoRow("GSTIN", m.gstin ?: t("Not given", "नहीं दिया"))
                InfoRow(t("Items registered", "दर्ज सामान"), "${m.registered}")
                InfoRow(t("Homes said not theirs", "घरों ने कहा उनका नहीं"), "${m.rejected}", valueColor = if (m.rejected > 0) Cw.critical else Cw.ink)
                InfoRow(t("Signed up", "पंजीकरण"), ago(m.createdAt, lang))
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (m.status != "APPROVED") PrimaryButton(t("Approve", "मंज़ूर करें"), { asking = m to "APPROVED" }, Modifier.weight(1f), icon = Lucide.Check, color = Cw.moss)
                    if (m.status == "APPROVED") SecondaryButton(t("Suspend", "निलंबित करें"), { asking = m to "SUSPENDED" }, Modifier.weight(1f), icon = Lucide.Ban, color = Cw.critical)
                }
            }
        }
    }

    asking?.let { (m, status) ->
        val approve = status == "APPROVED"
        Confirm(
            if (approve) t("Approve ${m.businessName}?", "${m.businessName} को मंज़ूरी दें?") else t("Suspend ${m.businessName}?", "${m.businessName} को निलंबित करें?"),
            if (approve) t("The shop can then scan cards and register items to homes.", "इसके बाद दुकान कार्ड स्कैन करके घरों में सामान दर्ज कर सकेगी।")
            else t("The shop can't scan cards or register items until approved again.", "दोबारा मंज़ूरी तक दुकान कार्ड स्कैन या सामान दर्ज नहीं कर पाएगी।"),
            if (approve) t("Approve", "मंज़ूर करें") else t("Suspend", "निलंबित करें"),
            danger = !approve,
            onConfirm = { scope.launch { patch(nav, "/api/admin/merchants/${m.id}", buildJsonObject { put("status", status) }, if (approve) "Shop approved." else "Shop suspended.") } },
            onDismiss = { asking = null },
        )
    }
}

@Composable
private fun sells(s: String) = when (s) {
    "APPLIANCES" -> t("Appliances", "बिजली का सामान")
    "VEHICLES" -> t("Vehicles", "गाड़ियाँ")
    "BOTH" -> t("Appliances + vehicles", "सामान + गाड़ियाँ")
    else -> s
}

// ---------------------------------------------------------------- removals

@Composable
fun RemovalsTab(nav: Nav) {
    val remote = rememberRemote("/api/admin/removals", RemovalsResponse.serializer())
    val lang = LocalLang.current
    RemoteList(remote) { data ->
        item(key = "head") {
            Column {
                Eyebrow(t("Removal requests", "हटाने के अनुरोध"))
                Text(t("Homes can't delete items; they ask, you decide", "घर ख़ुद सामान नहीं हटा सकते; वे पूछते हैं, आप तय करते हैं"), style = MaterialTheme.typography.titleMedium)
            }
        }
        val sorted = data.requests.sortedBy { if (it.status == "PENDING") 0 else 1 }
        if (sorted.isEmpty()) item { EmptyState(Lucide.Package, t("No requests", "कोई अनुरोध नहीं")) }
        items(sorted, key = { it.id }) { r ->
            CwCard(border = if (r.status == "PENDING") Cw.warningBorder else Cw.border, onClick = { nav.push("Removal request", "हटाने का अनुरोध") { RemovalDetail(r) } }) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(r.itemSummary, style = MaterialTheme.typography.titleSmall)
                        Text("${r.household?.name ?: ""} · ${reasonText(r.reason)} · ${ago(r.createdAt, lang)}", style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                    }
                    RemovalStatus(r.status)
                }
                if (r.photoIds.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Tag(t("${r.photoIds.size} photo(s)", "${r.photoIds.size} फ़ोटो"))
                }
            }
        }
    }
}

@Composable
private fun RemovalStatus(status: String) = when (status) {
    "APPROVED" -> StatusPill(Tone.GOOD, t("Removed", "हटाया"))
    "REJECTED" -> StatusPill(Tone.BAD, t("Kept", "रखा"))
    else -> StatusPill(Tone.WARN, t("To decide", "तय करना है"))
}

@Composable
private fun reasonText(reason: String) = when (reason) {
    "BROKEN" -> t("Broken", "ख़राब")
    "SOLD" -> t("Sold", "बेच दिया")
    "GIVEN_AWAY" -> t("Given away", "दे दिया")
    "SCRAPPED" -> t("Scrapped", "कबाड़")
    "NEVER_HAD" -> t("Never had it", "कभी था ही नहीं")
    "NOT_OURS" -> t("Not ours (shop's mistake)", "हमारा नहीं (दुकान की ग़लती)")
    else -> reason
}

@Composable
private fun RemovalDetail(r: AdminRemoval) {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var note by rememberSaveable { mutableStateOf("") }
    var asking by remember { mutableStateOf<String?>(null) }
    val pending = r.status == "PENDING"
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(r.itemSummary, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            RemovalStatus(r.status)
        }
        CwCard {
            InfoRow(t("Reason", "कारण"), reasonText(r.reason))
            InfoRow(t("Their words", "उनके शब्द"), r.note?.takeIf { it.isNotBlank() } ?: "—")
            r.shopName?.let { InfoRow(t("Registered by shop", "दुकान ने दर्ज किया"), it) }
            InfoRow(t("Asked", "अनुरोध"), date(r.createdAt))
        }
        r.household?.let { h ->
            CwCard(background = Cw.govSky, border = Cw.govSky) {
                Eyebrow(t("Home", "घर"), color = Cw.govNavy)
                Text(h.name, style = MaterialTheme.typography.titleMedium)
                Text(listOfNotNull(h.carbonId, h.city).joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                Spacer(Modifier.height(6.dp))
                InfoRow(t("Requests ever", "कुल अनुरोध"), "${h.requestsEver}", valueColor = if (h.requestsEver > 3) Cw.critical else Cw.ink)
                if (h.recentBills.isNotEmpty()) {
                    InfoRow(t("Recent bills", "हाल के बिल"), h.recentBills.joinToString("\n") { "${monthLabel(it.month)}: ${it.kwh.roundToInt()} kWh" })
                }
            }
        }
        if (r.photoIds.isNotEmpty()) {
            Eyebrow(t("Photos", "फ़ोटो"))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                r.photoIds.forEach { id ->
                    Box(Modifier.size(220.dp).clip(CardShape).background(Cw.subtle), contentAlignment = Alignment.Center) {
                        Icon(Lucide.Image, null, tint = Cw.inkLight)
                        AsyncImage(Http.url("/api/admin/removals/${r.id}/photos/$id"), t("Photo from the home", "घर से फ़ोटो"), Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    }
                }
            }
        }
        r.decisionNote?.let { Banner(Tone.INFO, t("Decision note: $it", "फ़ैसले का नोट: $it")) }
        if (pending) {
            CwTextField(note, { note = it.take(240) }, t("Note to the home (optional)", "घर के लिए नोट (ज़रूरी नहीं)"), singleLine = false, minLines = 2)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PrimaryButton(t("Remove item", "सामान हटाएँ"), { asking = "APPROVE" }, Modifier.weight(1f), icon = Lucide.Check, color = Cw.moss)
                SecondaryButton(t("Keep it", "रहने दें"), { asking = "REJECT" }, Modifier.weight(1f), icon = Lucide.Close, color = Cw.critical)
            }
            Text(
                t("Removing stops the item counting from now; the home gets a notification either way.", "हटाने पर अब से सामान नहीं गिना जाएगा; दोनों हालत में घर को सूचना मिलेगी।"),
                style = MaterialTheme.typography.bodySmall,
                color = Cw.inkMuted,
            )
        }
    }
    asking?.let { decision ->
        val approve = decision == "APPROVE"
        Confirm(
            if (approve) t("Remove this item?", "यह सामान हटाएँ?") else t("Keep this item?", "यह सामान रहने दें?"),
            r.itemSummary,
            if (approve) t("Remove", "हटाएँ") else t("Keep", "रहने दें"),
            danger = !approve,
            onConfirm = {
                scope.launch {
                    val ok = patch(nav, "/api/admin/removals/${r.id}", buildJsonObject {
                        put("decision", decision)
                        note.trim().takeIf { it.isNotEmpty() }?.let { put("note", it) }
                    }, if (approve) "Item removed." else "Request rejected.")
                    if (ok) nav.pop()
                }
            },
            onDismiss = { asking = null },
        )
    }
}

// ---------------------------------------------------------------- complaints

@Composable
fun ComplaintsTab(nav: Nav) {
    val remote = rememberRemote("/api/admin/grievances", GrievancesResponse.serializer())
    val lang = LocalLang.current
    var filter by rememberSaveable { mutableStateOf("OPEN") }
    RemoteList(remote) { data ->
        item(key = "filter") {
            Column {
                Eyebrow(t("Help & complaints", "सहायता और शिकायत"))
                Text(t("Every ticket gets a reply", "हर टिकट का जवाब दें"), style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(10.dp))
                ChoiceChips(
                    listOf(t("Open", "खुले") to "OPEN", t("In progress", "जारी") to "IN_PROGRESS", t("Resolved", "हल") to "RESOLVED", t("All", "सभी") to "ALL"),
                    filter,
                    { filter = it },
                )
            }
        }
        val shown = data.tickets.filter { filter == "ALL" || it.status == filter }
        if (shown.isEmpty()) item { EmptyState(Lucide.LifeBuoy, t("No tickets here", "यहाँ कोई टिकट नहीं"), t("Complaints from homes and shops land here.", "घरों और दुकानों की शिकायतें यहाँ आती हैं।")) }
        items(shown, key = { it.id }) { tk ->
            CwCard(onClick = { nav.push(tk.ticket.ifBlank { "Ticket" }, tk.ticket.ifBlank { "टिकट" }) { TicketDetail(tk) } }) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(tk.subject, style = MaterialTheme.typography.titleSmall)
                        Text("${tk.ticket} · ${tk.from?.name ?: ""} · ${ago(tk.createdAt, lang)}", style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                    }
                    TicketStatus(tk.status)
                }
            }
        }
    }
}

@Composable
private fun TicketStatus(status: String) = when (status) {
    "RESOLVED" -> StatusPill(Tone.GOOD, t("Resolved", "हल"))
    "IN_PROGRESS" -> StatusPill(Tone.INFO, t("In progress", "जारी"))
    else -> StatusPill(Tone.WARN, t("Open", "खुला"))
}

@Composable
private fun TicketDetail(tk: Ticket) {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var status by rememberSaveable { mutableStateOf("RESOLVED") }
    var reply by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(tk.subject, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            TicketStatus(tk.status)
        }
        CwCard {
            InfoRow(t("From", "किसकी"), listOfNotNull(tk.from?.name, tk.from?.email).joinToString("\n"))
            InfoRow(t("Topic", "विषय"), tk.category)
            InfoRow(t("Filed", "दर्ज"), date(tk.createdAt))
            Spacer(Modifier.height(6.dp))
            Text(tk.message, style = MaterialTheme.typography.bodyLarge)
        }
        tk.response?.let { Banner(Tone.INFO, t("Last reply: $it", "पिछला जवाब: $it")) }
        if (tk.status != "RESOLVED") {
            ChoiceChips(listOf(t("Working on it", "काम जारी") to "IN_PROGRESS", t("Resolved", "हल हो गया") to "RESOLVED"), status, { status = it })
            CwTextField(reply, { reply = it.take(2000) }, t("Reply (they see this)", "जवाब (उन्हें दिखेगा)"), singleLine = false, minLines = 4)
            PrimaryButton(t("Send reply", "जवाब भेजें"), {
                busy = true
                scope.launch {
                    val ok = patch(nav, "/api/admin/grievances/${tk.id}", buildJsonObject {
                        put("status", status)
                        put("response", reply.trim())
                    }, "Reply sent.")
                    busy = false
                    if (ok) nav.pop()
                }
            }, Modifier.fillMaxWidth(), icon = Lucide.Message, enabled = reply.trim().length >= 5, busy = busy, color = Cw.govNavy)
        }
    }
}

// ---------------------------------------------------------------- schemes

@Composable
fun SchemesTab(nav: Nav) {
    val remote = rememberRemote("/api/admin/schemes", AdminSchemes.serializer())
    val scope = rememberCoroutineScope()
    val lang = LocalLang.current
    RemoteList(remote) { data ->
        item(key = "head") {
            Column {
                Eyebrow(t("Scheme list", "योजना सूची"))
                Text(t("Keep the government schemes current", "सरकारी योजनाओं को अपडेट रखें"), style = MaterialTheme.typography.titleMedium)
                Text(t("Homes and shops see only Active schemes; \"Check\" shows a re-checking note.", "घर और दुकानें सिर्फ़ सक्रिय योजनाएँ देखते हैं; \"जाँच\" पर दोबारा जाँच का नोट दिखता है।"), style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
            }
        }
        items(data.schemes, key = { it.slug }) { s ->
            CwCard {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(lang.pick(s.name, s.nameHi), style = MaterialTheme.typography.titleSmall)
                        Text(
                            listOf(s.category, if (s.states == "ALL") t("All India", "पूरा भारत") else s.states, t("checked ${date(s.lastChecked)}", "जाँच ${date(s.lastChecked)}")).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = Cw.inkMuted,
                        )
                    }
                    when (s.status) {
                        "ACTIVE" -> StatusPill(Tone.GOOD, t("Active", "सक्रिय"))
                        "CHECK" -> StatusPill(Tone.WARN, t("Check", "जाँच"))
                        else -> StatusPill(Tone.NEUTRAL, t("Hidden", "छिपी"))
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(s.benefit, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(6.dp))
                Text(t("Shops explained it ${s.explained}× · helped apply ${s.applied}×", "दुकानों ने ${s.explained} बार समझाई · ${s.applied} बार आवेदन कराया"), style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SecondaryButton(t("Checked today", "आज जाँची"), {
                        scope.launch { patch(nav, "/api/admin/schemes/${s.slug}", buildJsonObject { put("markChecked", true) }, "Marked as checked today.") }
                    }, Modifier.weight(1f), icon = Lucide.CircleCheck)
                    val next = if (s.status == "HIDDEN") "ACTIVE" else "HIDDEN"
                    SecondaryButton(if (next == "HIDDEN") t("Hide", "छिपाएँ") else t("Show", "दिखाएँ"), {
                        scope.launch { patch(nav, "/api/admin/schemes/${s.slug}", buildJsonObject { put("status", next) }, if (next == "HIDDEN") "Scheme hidden." else "Scheme shown.") }
                    }, Modifier.weight(1f), icon = if (next == "HIDDEN") Lucide.EyeOff else Lucide.Eye, color = if (next == "HIDDEN") Cw.critical else Cw.moss)
                }
            }
        }
    }
}
