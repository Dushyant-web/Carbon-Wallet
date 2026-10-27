package app.carbonwallet.core.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.ui.theme.Cw

/** Grows from 0 to 1 once, so charts draw in instead of popping. */
@Composable
private fun rememberGrow(key: Any?): Animatable<Float, *> {
    val anim = remember(key) { Animatable(0f) }
    LaunchedEffect(key) { anim.animateTo(1f, tween(650, easing = FastOutSlowInEasing)) }
    return anim
}

data class Column1(val label: String, val value: Double, val highlight: Boolean = false, val muted: Boolean = false, val color: Color? = null)

/**
 * Vertical bars with the value printed on each bar and the label under it: direct labels, no legend,
 * the way the website draws its monthly graphs.
 */
@Composable
fun ColumnChart(
    bars: List<Column1>,
    modifier: Modifier = Modifier,
    height: Dp = 120.dp,
    color: Color = Cw.inkLight,
    highlightColor: Color = Cw.terracotta,
    valueText: (Double) -> String = { kgNumber(it) },
    description: String = "",
) {
    if (bars.isEmpty()) return
    val max = (bars.maxOf { it.value }).coerceAtLeast(1.0)
    val grow = rememberGrow(bars)
    Row(
        modifier.fillMaxWidth().height(height).semantics { contentDescription = description },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        bars.forEach { bar ->
            Column(Modifier.weight(1f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                val fraction = (bar.value / max).toFloat().coerceIn(0.02f, 1f) * grow.value
                // empty space above the bar, so every bar stands on the same baseline
                Spacer(Modifier.weight((1f - fraction).coerceAtLeast(0.001f)))
                Text(
                    valueText(bar.value),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (bar.highlight) Cw.ink else Cw.inkMuted,
                    fontWeight = if (bar.highlight) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                )
                Spacer(Modifier.height(3.dp))
                Box(
                    Modifier
                        .widthIn(max = 48.dp)
                        .fillMaxWidth(0.72f)
                        .weight(fraction.coerceAtLeast(0.001f), fill = true)
                        .background(
                            (bar.color ?: if (bar.highlight) highlightColor else color).copy(alpha = if (bar.muted) 0.45f else 1f),
                            RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp),
                        ),
                )
                Spacer(Modifier.height(4.dp))
                Box(Modifier.fillMaxWidth().height(1.dp).background(Cw.border))
                Spacer(Modifier.height(4.dp))
                Text(bar.label, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted, maxLines = 1, textAlign = TextAlign.Center)
            }
        }
    }
}

data class BarRowData(val label: String, val value: Double, val color: Color, val valueText: String, val sub: String? = null)

/** Horizontal bars, longest first: "where it went", "my home vs mohalla vs city". */
@Composable
fun BarRows(rows: List<BarRowData>, modifier: Modifier = Modifier, max: Double? = null) {
    if (rows.isEmpty()) return
    val top = (max ?: rows.maxOf { it.value }).coerceAtLeast(0.0001)
    val grow = rememberGrow(rows)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(9.dp).background(row.color, RoundedCornerShape(1.dp)))
                    Spacer(Modifier.width(8.dp))
                    Text(row.label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (row.sub != null) Text(row.sub, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted, modifier = Modifier.padding(horizontal = 8.dp))
                    Text(row.valueText, style = MaterialTheme.typography.titleSmall)
                }
                Spacer(Modifier.height(4.dp))
                Box(Modifier.fillMaxWidth().height(6.dp).background(Cw.subtle, RoundedCornerShape(1.dp))) {
                    Box(
                        Modifier
                            .fillMaxWidth((row.value / top).toFloat().coerceIn(0f, 1f) * grow.value)
                            .fillMaxHeight()
                            .background(row.color, RoundedCornerShape(1.dp)),
                    )
                }
            }
        }
    }
}

/**
 * Half-circle meter: this month against the home's allowance. The arc is green up to 90 %, amber to 110 %
 * and red beyond, matching the website's traffic-light thresholds.
 */
@Composable
fun AllowanceMeter(ratio: Double, tone: Tone, modifier: Modifier = Modifier, centre: @Composable () -> Unit) {
    val grow = rememberGrow(ratio)
    Box(modifier.fillMaxWidth().aspectRatio(2f), contentAlignment = Alignment.BottomCenter) {
        Canvas(Modifier.fillMaxWidth().aspectRatio(2f)) {
            val strokeW = size.width * 0.075f
            val diameter = size.width - strokeW
            val topLeft = Offset(strokeW / 2, strokeW / 2)
            val arcSize = Size(diameter, diameter)
            val maxRatio = 1.5
            fun sweep(r: Double) = (180f * (r / maxRatio).coerceIn(0.0, 1.0)).toFloat()
            // background bands at the thresholds
            drawArc(Cw.successSoft, 180f, sweep(0.9), false, topLeft, arcSize, style = Stroke(strokeW))
            drawArc(Cw.warningSoft, 180f + sweep(0.9), sweep(1.1) - sweep(0.9), false, topLeft, arcSize, style = Stroke(strokeW))
            drawArc(Cw.criticalSoft, 180f + sweep(1.1), 180f - sweep(1.1), false, topLeft, arcSize, style = Stroke(strokeW))
            // the home's value
            val valueColor = when (tone) {
                Tone.GOOD -> Cw.success
                Tone.WARN -> Cw.warning
                Tone.BAD -> Cw.critical
                else -> Cw.ink
            }
            drawArc(valueColor, 180f, sweep(ratio) * grow.value, false, topLeft, arcSize, style = Stroke(strokeW, cap = StrokeCap.Butt))
            // allowance tick at 100 %
            val angle = Math.toRadians((180.0 + sweep(1.0)))
            val r = diameter / 2
            val c = Offset(size.width / 2, strokeW / 2 + r)
            val inner = Offset(c.x + ((r - strokeW) * Math.cos(angle)).toFloat(), c.y + ((r - strokeW) * Math.sin(angle)).toFloat())
            val outer = Offset(c.x + ((r + strokeW * 0.7f) * Math.cos(angle)).toFloat(), c.y + ((r + strokeW * 0.7f) * Math.sin(angle)).toFloat())
            drawLine(Cw.ink, inner, outer, strokeWidth = 3f)
        }
        Box(Modifier.padding(bottom = 2.dp), contentAlignment = Alignment.BottomCenter) { centre() }
    }
}

/** Two series per month drawn as one bar with its share filled: e.g. items sold and how many were efficient. */
@Composable
fun SplitColumns(
    labels: List<String>,
    totals: List<Int>,
    parts: List<Int>,
    modifier: Modifier = Modifier,
    height: Dp = 150.dp,
    totalColor: Color = Cw.borderHover,
    partColor: Color = Cw.moss,
) {
    if (labels.isEmpty()) return
    val max = totals.maxOrNull()?.coerceAtLeast(1) ?: 1
    val grow = rememberGrow(totals)
    Row(modifier.fillMaxWidth().height(height), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
        labels.forEachIndexed { i, label ->
            Column(Modifier.weight(1f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                val fraction = (totals[i].toFloat() / max).coerceIn(0.02f, 1f) * grow.value
                Spacer(Modifier.weight((1f - fraction).coerceAtLeast(0.001f)))
                Text("${totals[i]}", style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                Spacer(Modifier.height(3.dp))
                Column(Modifier.fillMaxWidth(0.7f).weight(fraction.coerceAtLeast(0.001f)).background(totalColor, RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp))) {
                    val share = if (totals[i] > 0) parts[i].toFloat() / totals[i] else 0f
                    Spacer(Modifier.weight((1f - share).coerceAtLeast(0.001f)))
                    if (share > 0f) Box(Modifier.fillMaxWidth().weight(share).background(partColor))
                }
                Spacer(Modifier.height(4.dp))
                Box(Modifier.fillMaxWidth().height(1.dp).background(Cw.border))
                Spacer(Modifier.height(4.dp))
                Text(label, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted, maxLines = 1)
            }
        }
    }
}

@Composable
fun Legend(items: List<Pair<String, Color>>, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
        items.forEach { (label, color) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(9.dp).background(color, RoundedCornerShape(1.dp)))
                Spacer(Modifier.width(6.dp))
                Text(label, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
            }
        }
    }
}
