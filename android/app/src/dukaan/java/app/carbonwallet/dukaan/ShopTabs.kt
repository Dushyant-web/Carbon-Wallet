package app.carbonwallet.dukaan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.BarRowData
import app.carbonwallet.core.ui.BarRows
import app.carbonwallet.core.ui.ChoiceChips
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.KpiTile
import app.carbonwallet.core.ui.Legend
import app.carbonwallet.core.ui.ListRow
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PortalBand
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.SplitColumns
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.TileRow
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.ago
import app.carbonwallet.core.ui.count
import app.carbonwallet.core.ui.monthLabel
import app.carbonwallet.core.ui.rupees
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw

@Composable
fun ShopTab(nav: Nav) {
    val remote = rememberRemote("/api/merchant/dashboard", Dashboard.serializer())
    val lang = LocalLang.current
    RemoteList(remote, contentPadding = PaddingValues(bottom = 28.dp)) { d ->
        item(key = "band") {
            PortalBand(d.shop?.name ?: t("My shop", "मेरी दुकान"), listOfNotNull(d.shop?.city, sellsWords(d.shop?.sells)).joinToString(" · "))
        }
        item(key = "tiles") {
            val k = d.kpis
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                TileRow {
                    KpiTile(t("Items this month", "इस महीने सामान"), "${k.itemsThisMonth}", Modifier.weight(1f), sub = t("${count(k.itemsTotal)} in all", "कुल ${count(k.itemsTotal)}"), icon = Lucide.Package)
                    KpiTile(t("Homes served", "सेवा दिए घर"), count(k.customers), Modifier.weight(1f), sub = t("${k.scansThisMonth} scans this month", "इस महीने ${k.scansThisMonth} स्कैन"), icon = Lucide.Users)
                }
                TileRow {
                    KpiTile(t("Efficient share", "बचत वाला हिस्सा"), "${k.efficientPct}%", Modifier.weight(1f), sub = t("4★ and above", "4★ और ऊपर"), icon = Lucide.Leaf, accent = Cw.moss)
                    KpiTile(t("Sales value", "बिक्री मूल्य"), rupees(k.revenueInr), Modifier.weight(1f), sub = t("${k.catalogueItems} in catalogue", "कैटलॉग में ${k.catalogueItems}"), icon = Lucide.Rupee)
                }
                TileRow {
                    KpiTile(t("Schemes explained", "योजनाएँ समझाईं"), "${k.schemesExplained}", Modifier.weight(1f), sub = t("${k.schemesApplied} helped apply", "${k.schemesApplied} आवेदन कराए"), icon = Lucide.Landmark)
                    KpiTile(
                        t("Said not theirs", "उनका नहीं बताया"),
                        "${k.rejected}",
                        Modifier.weight(1f),
                        sub = if (k.rejected == 0) t("Clean record", "साफ़ रिकॉर्ड") else t("Admins review these", "एडमिन इन्हें जाँचते हैं"),
                        icon = if (k.rejected == 0) Lucide.ShieldCheck else Lucide.Alert,
                        accent = if (k.rejected == 0) Cw.ink else Cw.critical,
                    )
                }
            }
        }
        if (d.byMonth.isNotEmpty()) {
            item(key = "months") {
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Eyebrow(t("Last 6 months", "पिछले 6 महीने"))
                    Text(t("Items registered, and how many were efficient", "दर्ज सामान, और उनमें कितने बचत वाले"), style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(12.dp))
                    SplitColumns(
                        d.byMonth.map { monthLabel(it.month).substringBefore(' ') },
                        d.byMonth.map { it.items },
                        d.byMonth.map { it.efficient },
                    )
                    Spacer(Modifier.height(10.dp))
                    Legend(listOf(t("Efficient", "बचत वाले") to Cw.moss, t("Others", "बाकी") to Cw.borderHover))
                }
            }
        }
        if (d.topProducts.isNotEmpty()) {
            item(key = "top") {
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Eyebrow(t("Best sellers", "सबसे ज़्यादा बिके"))
                    Spacer(Modifier.height(12.dp))
                    BarRows(d.topProducts.map { BarRowData(it.title, it.sold.toDouble(), Cw.govBlue, "${it.sold}") })
                }
            }
        }
        if (d.recent.isNotEmpty()) {
            item(key = "recentTitle") { SectionHeader(t("Recent", "हाल ही में"), modifier = Modifier.padding(horizontal = 16.dp)) }
            items(d.recent, key = { it.id }) { r ->
                CwCard(Modifier.padding(horizontal = 16.dp), padding = 12.dp) {
                    ListRow(r.summary, subtitle = listOfNotNull(r.carbonId, ago(r.at, lang)).joinToString(" · "), icon = Lucide.Receipt, trailing = { SaleStatus(r.status) })
                }
            }
        }
    }
}

@Composable
fun SalesTab(nav: Nav) {
    val remote = rememberRemote("/api/merchant/sales", SalesResponse.serializer())
    val lang = LocalLang.current
    var filter by rememberSaveable { mutableStateOf("ALL") }
    RemoteList(remote) { data ->
        item(key = "filter") {
            Column {
                Eyebrow(t("Sales", "बिक्री"))
                Text(t("What you registered, and whether the home kept it", "आपने क्या दर्ज किया, और घर ने रखा या नहीं"), style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(10.dp))
                ChoiceChips(
                    listOf(t("All", "सभी") to "ALL", t("Kept", "रखा") to "REGISTERED", t("Disputed", "विवादित") to "REJECTED", t("Removed", "हटाया") to "REMOVED"),
                    filter,
                    { filter = it },
                )
            }
        }
        val shown = data.sales.filter { filter == "ALL" || it.status == filter }
        if (shown.isEmpty()) item { EmptyState(Lucide.Receipt, t("Nothing here", "यहाँ कुछ नहीं")) }
        items(shown, key = { it.id }) { s ->
            CwCard(padding = 12.dp) {
                ListRow(
                    s.summary,
                    subtitle = listOfNotNull(s.carbonId ?: t("Home erased", "घर मिटाया गया"), s.invoiceRef?.let { "#$it" }, ago(s.createdAt, lang)).joinToString(" · "),
                    icon = if (s.kind == "VEHICLE") Lucide.Car else Lucide.Package,
                    trailing = { SaleStatus(s.status) },
                )
            }
        }
    }
}

@Composable
private fun SaleStatus(status: String) {
    when (status) {
        "REGISTERED" -> StatusPill(Tone.GOOD, t("Kept", "रखा"))
        "REJECTED" -> StatusPill(Tone.BAD, t("Not theirs", "उनका नहीं"))
        "REMOVED", "CLOSED" -> StatusPill(Tone.NEUTRAL, t("Removed", "हटाया"))
        else -> StatusPill(Tone.NEUTRAL, status.lowercase())
    }
}

@Composable
private fun sellsWords(sells: String?) = when (sells) {
    "APPLIANCES" -> t("Appliances", "बिजली का सामान")
    "VEHICLES" -> t("Vehicles", "गाड़ियाँ")
    "BOTH" -> t("Appliances and vehicles", "बिजली का सामान और गाड़ियाँ")
    else -> null
}
