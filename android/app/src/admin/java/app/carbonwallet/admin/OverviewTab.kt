package app.carbonwallet.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.shell.roleWord
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.InfoRow
import app.carbonwallet.core.ui.KpiTile
import app.carbonwallet.core.ui.LinkButton
import app.carbonwallet.core.ui.ListRow
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PortalBand
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.TileRow
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.ago
import app.carbonwallet.core.ui.count
import app.carbonwallet.core.ui.date
import app.carbonwallet.core.ui.kgNumber
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw

const val OVERVIEW_PATH = "/api/admin/overview?users=25"

@Composable
fun OverviewTab(nav: Nav) {
    val remote = rememberRemote(OVERVIEW_PATH, AdminOverview.serializer())
    val ml = rememberRemote("/api/admin/ml", MlStatus.serializer())
    val removals = rememberRemote("/api/admin/removals", RemovalsResponse.serializer())
    val lang = LocalLang.current

    RemoteList(remote, contentPadding = PaddingValues(bottom = 28.dp)) { o ->
        item(key = "band") { PortalBand(t("Platform desk", "प्लेटफ़ॉर्म डेस्क"), t("Everything waiting for a decision, at a glance", "फ़ैसले के इंतज़ार में सब कुछ, एक नज़र में")) }

        val waitingShops = o.stats.merchantsPending
        val waitingRemovals = removals.data?.requests?.count { it.status == "PENDING" } ?: 0
        if (waitingShops > 0 || waitingRemovals > 0) {
            item(key = "todo") {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (waitingShops > 0) Banner(Tone.WARN, t(if (waitingShops == 1) "1 shop waiting for approval" else "$waitingShops shops waiting for approval", "$waitingShops दुकानें मंज़ूरी के इंतज़ार में"), action = { LinkButton(t("Review", "देखें"), { nav.tab(1) }) })
                    if (waitingRemovals > 0) Banner(Tone.WARN, t(if (waitingRemovals == 1) "1 removal request to decide" else "$waitingRemovals removal requests to decide", "$waitingRemovals हटाने के अनुरोध बाकी"), action = { LinkButton(t("Review", "देखें"), { nav.tab(2) }) })
                }
            }
        } else {
            item(key = "clear") { Banner(Tone.GOOD, t("Nothing waiting. All caught up.", "कुछ बाकी नहीं। सब निपट गया।"), Modifier.padding(horizontal = 16.dp)) }
        }

        item(key = "tiles") {
            val s = o.stats
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                TileRow {
                    KpiTile(t("Homes", "घर"), count(s.households), Modifier.weight(1f), sub = t("active", "सक्रिय"), icon = Lucide.Home)
                    KpiTile(t("Accounts", "खाते"), count(s.users), Modifier.weight(1f), sub = t("${count(s.usersWithLogin)} can sign in", "${count(s.usersWithLogin)} लॉग इन कर सकते हैं"), icon = Lucide.Users)
                }
                TileRow {
                    KpiTile(t("Shops", "दुकानें"), "${s.merchants}", Modifier.weight(1f), sub = t("${s.merchantsPending} pending", "${s.merchantsPending} बाकी"), icon = Lucide.Store, accent = if (s.merchantsPending > 0) Cw.warning else Cw.ink)
                    KpiTile(t("Activities", "गतिविधियाँ"), count(s.activities), Modifier.weight(1f), sub = t("logged", "दर्ज"), icon = Lucide.ListChecks)
                }
            }
        }

        ml.data?.let { m ->
            item(key = "ml") {
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Eyebrow(t("Forecast model", "पूर्वानुमान मॉडल"), Modifier.weight(1f))
                        when {
                            !m.trained -> StatusPill(Tone.WARN, t("Not trained", "प्रशिक्षित नहीं"))
                            m.info?.beatsBaseline == true -> StatusPill(Tone.GOOD, t("Beats the baseline", "बेसलाइन से बेहतर"))
                            else -> StatusPill(Tone.BAD, t("Worse than baseline", "बेसलाइन से ख़राब"))
                        }
                    }
                    m.info?.let { info ->
                        Spacer(Modifier.height(8.dp))
                        info.heldOut?.model?.let { s ->
                            InfoRow(t("Typical error", "आम ग़लती"), "${s.maeKg?.let { kgNumber(it) } ?: "—"} kg · ${s.mapePct?.let { kgNumber(it) } ?: "—"}%")
                        }
                        info.heldOut?.lastMonth?.let { s -> InfoRow(t("\"Same as last month\" guess", "\"पिछले महीने जैसा\" अनुमान"), "${s.maeKg?.let { kgNumber(it) } ?: "—"} kg") }
                        InfoRow(t("Trained", "प्रशिक्षण"), date(info.trainedAt))
                    }
                    m.data?.let { d -> InfoRow(t("Homes with history", "इतिहास वाले घर"), t("${count(d.homesWithHistory)} (${d.realHomes} real)", "${count(d.homesWithHistory)} (${d.realHomes} असली)")) }
                }
            }
        }

        if (o.deletions.pending.isNotEmpty()) {
            item(key = "delTitle") { SectionHeader(t("Erasures scheduled", "मिटाना तय"), t("Read-only: nobody can stop or speed these up", "सिर्फ़ देखने के लिए: इन्हें कोई रोक या जल्दी नहीं कर सकता"), Modifier.padding(horizontal = 16.dp)) }
            items(o.deletions.pending, key = { "d-" + it.kind + it.name + it.requestedAt }) { d ->
                CwCard(Modifier.padding(horizontal = 16.dp), padding = 12.dp) {
                    ListRow(d.name, subtitle = t("${d.kind} · erased on ${date(d.eraseOn)}", "${d.kind} · ${date(d.eraseOn)} को मिटेगा"), icon = Lucide.Clock)
                }
            }
        }

        if (o.audit.isNotEmpty()) {
            item(key = "auditTitle") { SectionHeader(t("Recent activity", "हाल की गतिविधि"), modifier = Modifier.padding(horizontal = 16.dp)) }
            item(key = "audit") {
                CwCard(Modifier.padding(horizontal = 16.dp), padding = 12.dp) {
                    o.audit.forEachIndexed { i, a ->
                        Column(Modifier.padding(vertical = 8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Tag(a.action)
                                Spacer(Modifier.padding(start = 8.dp))
                                Text(ago(a.at, lang), style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                            }
                            Text(a.details ?: "", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                            Text("${a.user} · ${a.household}", style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
                        }
                        if (i < o.audit.lastIndex) app.carbonwallet.core.ui.Hairline()
                    }
                }
            }
        }

        if (o.users.isNotEmpty()) {
            item(key = "usersTitle") { SectionHeader(t("Newest accounts", "नए खाते"), t("${o.users.size} of ${count(o.stats.users)}", "${count(o.stats.users)} में से ${o.users.size}"), Modifier.padding(horizontal = 16.dp)) }
            items(o.users, key = { "u-" + it.id }) { u ->
                CwCard(Modifier.padding(horizontal = 16.dp), padding = 12.dp) {
                    ListRow(
                        u.name.ifBlank { u.email },
                        subtitle = "${u.email} · ${ago(u.createdAt, lang)}",
                        icon = if (u.platformRole == "MERCHANT") Lucide.Store else if (u.platformRole == "ADMIN") Lucide.ShieldCheck else Lucide.User,
                        trailing = {
                            if (u.status != "ACTIVE") StatusPill(Tone.BAD, u.status.lowercase()) else Tag(roleWord(u.platformRole))
                        },
                    )
                }
            }
        }
    }
}
