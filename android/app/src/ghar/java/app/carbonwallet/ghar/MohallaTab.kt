package app.carbonwallet.ghar

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.BarRowData
import app.carbonwallet.core.ui.BarRows
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.KpiTile
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PortalBand
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.TileRow
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.kg
import app.carbonwallet.core.ui.pick
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.roundToInt

@Composable
fun MohallaTab(nav: Nav) = WithHome { home ->
    val remote = rememberRemote(homePath(home.id, "mohalla"), MohallaResponse.serializer())
    val lang = LocalLang.current

    RemoteList(remote, contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 28.dp)) { m ->
        item(key = "band") {
            PortalBand(
                m.mohalla?.name ?: m.place ?: t("My mohalla", "मेरा मोहल्ला"),
                listOfNotNull(
                    m.mohalla?.homes?.let { t("$it homes", "$it घर") },
                    m.location?.district,
                    m.location?.pincode?.let { t("PIN $it", "पिन $it") },
                ).joinToString(" · "),
            )
        }

        val levels = m.levels.filter { !it.hidden && it.kgPerPerson != null }
        if (levels.isNotEmpty()) {
            item(key = "compare") {
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Eyebrow(t("Per person, this month", "प्रति व्यक्ति, इस महीने"))
                    Text(t("Your home next to your area", "आपका घर और आपका इलाक़ा"), style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(14.dp))
                    BarRows(levels.map { l ->
                        BarRowData(
                            lang.pick(l.name, l.nameHi),
                            l.kgPerPerson ?: 0.0,
                            if (l.level == "HOME") Cw.terracotta else Cw.govBlue.copy(alpha = 0.55f + 0.1f * levels.indexOf(l).coerceAtMost(4)),
                            kg(l.kgPerPerson),
                            sub = l.homes?.takeIf { l.level != "HOME" }?.let { t("$it homes", "$it घर") },
                        )
                    })
                    val hidden = m.levels.count { it.hidden }
                    if (hidden > 0) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            t("Areas with fewer than ${m.minHomes} homes stay hidden, for privacy.", "${m.minHomes} से कम घरों वाले इलाक़े निजता के लिए छिपे रहते हैं।"),
                            style = MaterialTheme.typography.bodySmall,
                            color = Cw.inkMuted,
                        )
                    }
                }
            }
        }

        m.weather?.let { w ->
            item(key = "weather") { WeatherCard(w, m.heat) }
        }

        m.facts?.let { f ->
            item(key = "facts") {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    TileRow {
                        KpiTile(t("Green homes", "हरे घर"), "${f.green}", Modifier.weight(1f), sub = t("of ${f.homesWithData} with data", "${f.homesWithData} में से"), icon = Lucide.Leaf, accent = Cw.moss)
                        KpiTile(t("Efficient buys", "बचत वाला सामान"), "${f.efficientItems}", Modifier.weight(1f), sub = t("of ${f.shopItems} shop items", "${f.shopItems} दुकान के सामान में से"), icon = Lucide.Star)
                    }
                    TileRow {
                        KpiTile(t("Scheme help", "योजना मदद"), "${f.schemeAsks}", Modifier.weight(1f), sub = t("${f.schemeApplied} applied", "${f.schemeApplied} ने आवेदन किया"), icon = Lucide.Landmark)
                        KpiTile(t("Homes", "घर"), "${m.mohalla?.homes ?: f.homesWithData}", Modifier.weight(1f), sub = t("in this mohalla", "इस मोहल्ले में"), icon = Lucide.Home)
                    }
                }
            }
        }

        if (m.feed.isNotEmpty()) {
            item(key = "feedTitle") {
                SectionHeader(t("Today's mohalla", "आज का मोहल्ला"), t("News from your area, in plain words", "आपके इलाक़े की खबर, आसान शब्दों में"), Modifier.padding(horizontal = 16.dp))
            }
            items(m.feed, key = { it.kind + (it.title?.en ?: it.en).take(40) }) { f ->
                CwCard(Modifier.padding(horizontal = 16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(feedIcon(f.kind), null, tint = Cw.govNavy, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(lang.pick(f.title?.en ?: "", f.title?.hi), style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(lang.pick(f.en, f.hi), style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted)
                    f.source?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(t("Source: $it", "स्रोत: $it"), style = MaterialTheme.typography.labelSmall, color = Cw.inkLight)
                    }
                }
            }
        }
    }
}

@Composable
private fun WeatherCard(w: Weather, heat: Heat?) {
    CwCard(Modifier.padding(horizontal = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(t("Weather and air", "मौसम और हवा"), Modifier.weight(1f))
            w.air?.let { air -> StatusPill(aqiTone(air.aqi), t("AQI ${air.aqi ?: "—"} · ${air.band ?: ""}", "AQI ${air.aqi ?: "—"} · ${aqiBandHi(air.band)}")) }
        }
        Spacer(Modifier.height(12.dp))
        w.now?.let { now ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(weatherIcon(now.code), null, tint = Cw.warning, modifier = Modifier.size(40.dp))
                Spacer(Modifier.width(14.dp))
                Column {
                    Text("${now.tempC?.roundToInt() ?: "—"}°C", style = MaterialTheme.typography.displaySmall)
                    Text(
                        t("Feels like ${now.feelsC?.roundToInt() ?: "—"}°C · humidity ${now.humidity?.roundToInt() ?: "—"}%", "महसूस ${now.feelsC?.roundToInt() ?: "—"}°C · नमी ${now.humidity?.roundToInt() ?: "—"}%"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Cw.inkMuted,
                    )
                }
            }
        }
        if (heat != null && heat.level != "NONE") {
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().background(Cw.criticalSoft, CardShape).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Lucide.Thermometer, null, tint = Cw.criticalText, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    t("Heat ahead (${heat.maxC?.roundToInt()}°C): AC may add about ${kg(heat.extraKg)}.", "गर्मी आने वाली है (${heat.maxC?.roundToInt()}°C): AC से लगभग ${kg(heat.extraKg)} बढ़ सकता है।"),
                    style = MaterialTheme.typography.bodySmall,
                    color = Cw.criticalText,
                )
            }
        }
        if (w.days.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                w.days.take(7).forEachIndexed { i, d ->
                    Column(
                        Modifier.background(if (i == 0) Cw.govSky else Cw.subtle, CardShape).padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(dayName(d.date, i), style = MaterialTheme.typography.labelMedium, color = Cw.inkMuted)
                        Spacer(Modifier.height(4.dp))
                        Icon(weatherIcon(d.code), null, tint = Cw.inkMuted, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.height(4.dp))
                        Text("${d.maxC?.roundToInt() ?: "—"}°", style = MaterialTheme.typography.titleSmall)
                        Text("${d.minC?.roundToInt() ?: "—"}°", style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                        if ((d.rainPct ?: 0.0) >= 30) Text("${d.rainPct?.roundToInt()}%", style = MaterialTheme.typography.labelSmall, color = Cw.vizTransport)
                    }
                }
            }
        }
        w.source?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, style = MaterialTheme.typography.labelSmall, color = Cw.inkLight, maxLines = 2)
        }
    }
}

@Composable
private fun dayName(date: String, index: Int): String {
    if (index == 0) return t("Today", "आज")
    val lang = LocalLang.current
    return runCatching {
        LocalDate.parse(date).dayOfWeek.getDisplayName(TextStyle.SHORT, if (lang == app.carbonwallet.core.ui.Lang.HI) Locale.forLanguageTag("hi-IN") else Locale.ENGLISH)
    }.getOrDefault(date.takeLast(5))
}

/** Indian AQI bands: good/satisfactory green, moderate amber, poor and worse red. */
private fun aqiTone(aqi: Int?): Tone = when {
    aqi == null -> Tone.NEUTRAL
    aqi <= 100 -> Tone.GOOD
    aqi <= 200 -> Tone.WARN
    else -> Tone.BAD
}

private fun aqiBandHi(band: String?) = when (band?.lowercase()) {
    "good" -> "अच्छी"
    "satisfactory" -> "संतोषजनक"
    "moderate" -> "मध्यम"
    "poor" -> "ख़राब"
    "very poor" -> "बहुत ख़राब"
    "severe" -> "गंभीर"
    else -> band ?: ""
}

/** WMO weather codes, as Open-Meteo sends them. */
private fun weatherIcon(code: Int): ImageVector = when (code) {
    0, 1 -> Lucide.Sun
    in 51..67, in 80..82, in 95..99 -> Lucide.Rain
    else -> Lucide.Cloud
}

private fun feedIcon(kind: String): ImageVector = when (kind.uppercase()) {
    "TREND" -> Lucide.Chart
    "WEATHER", "HEAT" -> Lucide.Thermometer
    "AIR" -> Lucide.Wind
    "SCHEME" -> Lucide.Landmark
    "SHOP" -> Lucide.Store
    "GREEN" -> Lucide.Leaf
    else -> Lucide.Info
}
