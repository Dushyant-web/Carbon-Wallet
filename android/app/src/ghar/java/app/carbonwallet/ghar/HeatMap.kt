package app.carbonwallet.ghar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.Hairline
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.kg
import app.carbonwallet.core.ui.kgNumber
import app.carbonwallet.core.ui.monthLabel
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import kotlinx.serialization.Serializable
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min

@Serializable
data class HeatMapResponse(
    val month: String? = null,
    val minHomes: Int = 20,
    val allowancePerPersonKg: Double = 100.0,
    val areas: List<HeatArea> = emptyList(),
)

@Serializable
data class HeatArea(
    val id: String,
    val name: String = "",
    val city: String = "",
    val state: String = "",
    val homes: Int = 0,
    val kgPerPerson: Double = 0.0,
    /** outer rings of [lat, lng] points */
    val outline: List<List<List<Double>>> = emptyList(),
)

/** Light to dark terracotta, the same five steps as the website's heat map. */
private val HeatColours = listOf(Color(0xFFF3E3D6), Color(0xFFE9C3A6), Color(0xFFD9946E), Color(0xFFC06B47), Color(0xFF933A21))

private fun heatColour(kg: Double, min: Double, max: Double): Color {
    val step = if (max <= min) 2 else (((kg - min) / (max - min)) * HeatColours.size).toInt()
    return HeatColours[step.coerceIn(0, HeatColours.lastIndex)]
}

/** Carbon per person by mohalla, one city at a time. Colours are shared across cities, so they compare. */
@Composable
fun HeatMapScreen(myArea: String?) {
    val remote = rememberRemote("/api/heatmap", HeatMapResponse.serializer())
    var picked by rememberSaveable { mutableStateOf<String?>(null) }

    RemoteList(remote) { data ->
        val areas = data.areas
        val low = areas.minOfOrNull { it.kgPerPerson } ?: 0.0
        val high = areas.maxOfOrNull { it.kgPerPerson } ?: 0.0
        // the family's own city first, then the cities with the most areas
        val home = areas.firstOrNull { it.name == myArea }?.city
        val cities = areas.groupBy { it.city }.entries.sortedWith(compareBy({ it.key != home }, { -it.value.size })).map { it.key }
        val city = picked?.takeIf { it in cities } ?: cities.firstOrNull()
        val shown = areas.filter { it.city == city }.sortedByDescending { it.kgPerPerson }

        item(key = "intro") {
            Text(
                t(
                    "Darker means more carbon per person in ${monthLabel(data.month)}. Only areas with ${data.minHomes} or more homes are shown, never a single home.",
                    "गहरा रंग यानी ${monthLabel(data.month)} में प्रति व्यक्ति ज़्यादा कार्बन। सिर्फ़ ${data.minHomes} या ज़्यादा घरों वाले इलाक़े दिखते हैं, कोई एक घर नहीं।",
                ),
                style = MaterialTheme.typography.bodySmall,
                color = Cw.inkMuted,
            )
        }

        if (areas.isEmpty()) {
            item(key = "empty") {
                EmptyState(Lucide.Flame, t("No area to show yet", "अभी दिखाने को कोई इलाक़ा नहीं"), t("An area shows once it has enough homes.", "पर्याप्त घर होते ही इलाक़ा दिखेगा।"))
            }
        } else {
            item(key = "cities") {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    cities.forEach { c ->
                        val on = c == city
                        Text(
                            c,
                            style = MaterialTheme.typography.labelLarge,
                            color = if (on) Color.White else Cw.ink,
                            modifier = Modifier
                                .clip(CardShape)
                                .background(if (on) Cw.govNavy else Cw.card)
                                .border(1.dp, if (on) Cw.govNavy else Cw.border, CardShape)
                                .clickable { picked = c }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                        )
                    }
                }
            }

            item(key = "map") {
                CwCard(padding = 8.dp) {
                    AreaMap(shown, low, high, myArea, Modifier.fillMaxWidth().aspectRatio(1.6f))
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(kg(low), style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                        Spacer(Modifier.width(6.dp))
                        HeatColours.forEach { Box(Modifier.weight(1f).height(8.dp).background(it)) }
                        Spacer(Modifier.width(6.dp))
                        Text(kg(high), style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        t("Allowance: ${kgNumber(data.allowancePerPersonKg)} kg a person each month", "सीमा: हर महीने ${kgNumber(data.allowancePerPersonKg)} किलो प्रति व्यक्ति"),
                        style = MaterialTheme.typography.labelSmall,
                        color = Cw.inkMuted,
                    )
                }
            }

            item(key = "list") {
                CwCard(padding = 0.dp) {
                    Text(
                        t("$city, highest first", "$city, सबसे ज़्यादा पहले"),
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                    shown.forEach { a ->
                        Hairline()
                        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(12.dp).background(heatColour(a.kgPerPerson, low, high)))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(a.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(
                                    t("${a.homes} homes", "${a.homes} घर") + if (a.name == myArea) t(" · your area", " · आपका इलाक़ा") else "",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (a.name == myArea) Cw.govBlue else Cw.inkMuted,
                                )
                            }
                            Text(kg(a.kgPerPerson), style = MaterialTheme.typography.titleSmall)
                        }
                    }
                }
            }
        }
    }
}

/** Draws each mohalla's outline, fitted to the box; the family's own area gets a dark edge. */
@Composable
private fun AreaMap(areas: List<HeatArea>, low: Double, high: Double, myArea: String?, modifier: Modifier) {
    val rings = areas.flatMap { a -> a.outline.filter { it.size >= 3 }.map { a to it } }
    val points = rings.flatMap { it.second }
    if (points.isEmpty()) return
    val south = points.minOf { it[0] }
    val north = points.maxOf { it[0] }
    val west = points.minOf { it[1] }
    val east = points.maxOf { it[1] }
    // a degree of longitude is shorter than a degree of latitude away from the equator
    val squash = cos(Math.toRadians((south + north) / 2))

    Canvas(modifier.background(Cw.subtle)) {
        val pad = 12.dp.toPx()
        val w = max((east - west) * squash, 1e-6)
        val h = max(north - south, 1e-6)
        val scale = min((size.width - 2 * pad) / w, (size.height - 2 * pad) / h)
        val left = (size.width - w * scale) / 2
        val top = (size.height - h * scale) / 2
        fun x(p: List<Double>) = (left + (p[1] - west) * squash * scale).toFloat()
        fun y(p: List<Double>) = (top + (north - p[0]) * scale).toFloat()

        rings.forEach { (a, ring) ->
            val path = Path().apply {
                moveTo(x(ring[0]), y(ring[0]))
                ring.drop(1).forEach { lineTo(x(it), y(it)) }
                close()
            }
            val mine = a.name == myArea
            drawPath(path, heatColour(a.kgPerPerson, low, high))
            drawPath(path, if (mine) Cw.ink else Color(0xFF5F594E), style = Stroke(if (mine) 2.5.dp.toPx() else 1.dp.toPx()))
        }
    }
}
