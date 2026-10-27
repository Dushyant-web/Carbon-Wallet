package app.carbonwallet.ghar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.model.PortalUpdates
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.shell.memberRole
import app.carbonwallet.core.ui.AllowanceMeter
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.BarRowData
import app.carbonwallet.core.ui.BarRows
import app.carbonwallet.core.ui.Column1
import app.carbonwallet.core.ui.ColumnChart
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Ticker
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.kg
import app.carbonwallet.core.ui.kgNumber
import app.carbonwallet.core.ui.pct
import app.carbonwallet.core.ui.rupees
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import kotlin.math.roundToInt

/** Same thresholds as the website (src/lib/allowance.ts): green ≤ 90 %, amber ≤ 110 %, red above. */
fun statusFor(usedKg: Double, allowanceKg: Double): Tone {
    val ratio = if (allowanceKg > 0) usedKg / allowanceKg else 0.0
    return when {
        ratio <= 0.9 -> Tone.GOOD
        ratio <= 1.1 -> Tone.WARN
        else -> Tone.BAD
    }
}

@Composable
fun statusWords(tone: Tone) = when (tone) {
    Tone.GOOD -> t("Green · within your allowance", "हरा · आपकी सीमा के अंदर")
    Tone.WARN -> t("Amber · close to your allowance", "पीला · आपकी सीमा के पास")
    else -> t("Red · over your allowance", "लाल · आपकी सीमा से ज़्यादा")
}

@Composable
fun categoryName(category: String) = when (category.lowercase()) {
    "electricity" -> t("Electricity", "बिजली")
    "transport" -> t("Transport", "गाड़ी")
    "travel" -> t("Travel", "यात्रा")
    "cooking" -> t("Cooking gas", "रसोई गैस")
    else -> category
}

@Composable
fun HomeTab(nav: Nav) = WithHome { home ->
    val remote = rememberRemote(homePath(home.id, "overview"), Overview.serializer())
    val updates = rememberRemote("/api/public/updates", PortalUpdates.serializer())

    RemoteList(remote, contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 28.dp)) { o ->
        item(key = "ticker") { Ticker(updates.data?.updates.orEmpty()) }

        item(key = "hello") {
            Column(Modifier.padding(horizontal = 16.dp).padding(top = 6.dp)) {
                val first = Session.me?.user?.name?.substringBefore(' ').orEmpty()
                Text(t("Namaste, $first", "नमस्ते, $first"), style = MaterialTheme.typography.headlineMedium)
                val h = o.household
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        listOfNotNull(h?.name, h?.city?.takeIf { it.isNotBlank() }, h?.let { t("${it.size} people", "${it.size} लोग") }).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Cw.inkMuted,
                        modifier = Modifier.weight(1f),
                    )
                    Tag(memberRole(home.role))
                }
            }
        }

        val kpi = o.kpi
        val allowance = o.allowance
        if (kpi != null && allowance != null && o.period?.hasData == true) {
            item(key = "hero") { Hero(o, kpi, allowance) }
        } else {
            item(key = "nodata") {
                Banner(Tone.INFO, t("No numbers yet. Add an electricity bill to see this month's carbon.", "अभी कोई आँकड़ा नहीं। इस महीने का कार्बन देखने के लिए बिजली बिल जोड़ें।"), Modifier.padding(horizontal = 16.dp))
            }
        }

        o.period?.newerPartial?.let { p ->
            item(key = "partial") {
                Banner(
                    Tone.INFO,
                    t(
                        "${p.label}: ${kg(p.totalKg)} so far (${p.billedDays ?: "?"} of ${p.daysInMonth ?: "?"} days billed). The full month shows once its bill is in.",
                        "${p.label}: अब तक ${kg(p.totalKg)} (${p.daysInMonth ?: "?"} में से ${p.billedDays ?: "?"} दिन का बिल)। पूरा महीना बिल आने पर दिखेगा।",
                    ),
                    Modifier.padding(horizontal = 16.dp),
                )
            }
        }

        o.nextBestAction?.let { a ->
            item(key = "action") {
                CwCard(Modifier.padding(horizontal = 16.dp), background = Cw.mossSoft, border = Cw.successBorder) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Lucide.Target, null, tint = Cw.moss, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Eyebrow(t("One thing to do this month", "इस महीने एक काम"), color = Cw.successText)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(a.action, style = MaterialTheme.typography.titleLarge)
                    if (a.description.isNotBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Text(a.description, style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Tag(t("Saves ${kg(a.kgSaved)}/month", "हर महीने ${kg(a.kgSaved)} बचत"), color = Cw.successText, background = Cw.card)
                        Tag("≈ ${rupees(a.inrSaved)}", color = Cw.successText, background = Cw.card)
                        if (a.difficulty.isNotBlank()) Tag(difficulty(a.difficulty), background = Cw.card)
                    }
                }
            }
        }

        if (o.trendHistory.isNotEmpty()) {
            item(key = "trend") {
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Eyebrow(t("Last 6 months", "पिछले 6 महीने"))
                    Text(t("Your home's carbon each month, in kg", "हर महीने आपके घर का कार्बन, किलो में"), style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(14.dp))
                    ColumnChart(
                        o.trendHistory.takeLast(6).map { Column1(it.label, it.totalKg, highlight = it.isReporting, muted = it.partial) },
                        description = "Monthly carbon chart",
                    )
                }
            }
        }

        val breakdown = o.categoryBreakdown.filterValues { it > 0 }.toList().sortedByDescending { it.second }
        if (breakdown.isNotEmpty()) {
            item(key = "where") {
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Eyebrow(t("Where it went", "कहाँ गया"))
                    val top = kpi?.topContributor
                    if (top != null) {
                        Text(
                            t("${categoryName(top.category)} was ${top.sharePct.roundToInt()}% of the month", "महीने का ${top.sharePct.roundToInt()}% ${categoryName(top.category)} से"),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                    Spacer(Modifier.height(14.dp))
                    BarRows(breakdown.map { (cat, value) -> BarRowData(categoryName(cat), value, Cw.category(cat), kg(value)) })
                }
            }
        }

        allowance?.let { a ->
            item(key = "howcalc") {
                Text(
                    t(
                        "Allowance: ${kgNumber(a.perPersonKg)} kg per person a month × ${o.household?.size ?: 1} people = ${kg(a.allowanceKg)}.",
                        "सीमा: ${kgNumber(a.perPersonKg)} किलो प्रति व्यक्ति हर महीने × ${o.household?.size ?: 1} लोग = ${kg(a.allowanceKg)}।",
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = Cw.inkMuted,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}

@Composable
private fun Hero(o: Overview, kpi: Kpi, allowance: Allowance) {
    val used = kpi.totalEmissions
    val tone = statusFor(used, allowance.allowanceKg)
    val ratio = if (allowance.allowanceKg > 0) used / allowance.allowanceKg else 0.0
    CwCard(Modifier.padding(horizontal = 16.dp), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(o.period?.label ?: t("This month", "इस महीने"), Modifier.weight(1f))
            StatusPill(tone, when (tone) {
                Tone.GOOD -> t("Green", "हरा")
                Tone.WARN -> t("Amber", "पीला")
                else -> t("Red", "लाल")
            })
        }
        Spacer(Modifier.height(12.dp))
        AllowanceMeter(ratio, tone, Modifier.padding(horizontal = 56.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(kgNumber(used), style = MaterialTheme.typography.displayMedium)
                Text(t("kg CO₂e this month", "किलो CO₂e इस महीने"), style = MaterialTheme.typography.labelMedium, color = Cw.inkMuted)
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(statusWords(tone), style = MaterialTheme.typography.titleSmall, color = tone.fg, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Text(
            t("${(ratio * 100).roundToInt()}% of your home's allowance (${kg(allowance.allowanceKg)})", "आपके घर की सीमा (${kg(allowance.allowanceKg)}) का ${(ratio * 100).roundToInt()}%"),
            style = MaterialTheme.typography.bodySmall,
            color = Cw.inkMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        kpi.trendPct?.let { trend ->
            Spacer(Modifier.height(12.dp))
            val down = trend < 0
            Row(
                Modifier.fillMaxWidth().background(if (down) Cw.successSoft else Cw.criticalSoft).padding(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(if (down) Lucide.TrendDown else Lucide.TrendUp, null, tint = if (down) Cw.successText else Cw.criticalText, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    if (down) t("${pct(trend)} less than last month", "पिछले महीने से ${pct(trend)} कम")
                    else t("${pct(trend)} more than last month", "पिछले महीने से ${pct(trend)} ज़्यादा"),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (down) Cw.successText else Cw.criticalText,
                )
            }
        }
    }
}

@Composable
private fun difficulty(d: String) = when (d.uppercase()) {
    "EASY" -> t("Easy", "आसान")
    "MEDIUM" -> t("Some effort", "थोड़ी मेहनत")
    "HARD" -> t("Big change", "बड़ा बदलाव")
    else -> d
}
