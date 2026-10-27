package app.carbonwallet.core.ui

import android.graphics.Paint
import android.graphics.Path as AndroidPath
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.carbonwallet.core.model.PortalUpdate
import app.carbonwallet.core.ui.theme.Cw

/** Saffron · white · green hairline, the first thing on every public-portal page. */
@Composable
fun Tricolour(modifier: Modifier = Modifier, height: Dp = 3.dp) {
    Row(modifier.fillMaxWidth().height(height)) {
        Box(Modifier.weight(1f).fillMaxHeight().background(Cw.tricolourSaffron))
        Box(Modifier.weight(1f).fillMaxHeight().background(Color.White))
        Box(Modifier.weight(1f).fillMaxHeight().background(Cw.indiaGreen))
    }
}

/**
 * Carbon Wallet's own round seal (a home with a leaf in a ring of bilingual text), drawn from the website's Seal.tsx.
 * Deliberately not the State Emblem: this is a citizen service and must not pretend to be the government.
 */
@Composable
fun Seal(size: Dp, modifier: Modifier = Modifier, withText: Boolean = true) {
    Canvas(modifier.size(size).semantics { contentDescription = "Carbon Wallet seal" }) {
        val k = this.size.width / 120f
        scale(k, k, pivot = Offset.Zero) {
            drawCircle(Cw.govNavy, 58f, Offset(60f, 60f))
            drawCircle(Cw.saffron, 52f, Offset(60f, 60f), style = Stroke(1.5f))
            drawCircle(Cw.card, 33f, Offset(60f, 60f))
            val house = Path().apply {
                moveTo(44f, 62f); lineTo(60f, 48f); lineTo(76f, 62f); lineTo(76f, 77f); lineTo(44f, 77f); close()
            }
            drawPath(house, Cw.govNavy)
            drawRect(Cw.card, Offset(55f, 66f), androidx.compose.ui.geometry.Size(10f, 11f))
            val leaf = Path().apply {
                moveTo(60f, 50f); cubicTo(66f, 38f, 79f, 36f, 82f, 34f); cubicTo(80f, 46f, 72f, 54f, 60f, 50f); close()
            }
            drawPath(leaf, Cw.indiaGreen)
            val vein = Path().apply { moveTo(61f, 49.5f); cubicTo(68f, 44f, 74f, 40f, 81f, 35f) }
            drawPath(vein, Cw.card, style = Stroke(1f))
            drawCircle(Cw.saffron, 2.2f, Offset(21f, 60f))
            drawCircle(Cw.saffron, 2.2f, Offset(99f, 60f))
            if (withText) {
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Cw.card.toArgb()
                    textAlign = Paint.Align.CENTER
                    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                }
                val top = AndroidPath().apply { addArc(18f, 18f, 102f, 102f, 180f, 180f) }
                paint.textSize = 10.5f
                paint.letterSpacing = 0.2f
                drawContext.canvas.nativeCanvas.drawTextOnPath("CARBON WALLET", top, 0f, 3.5f, paint)
                val bottom = AndroidPath().apply { addArc(22f, 22f, 98f, 98f, 180f, -180f) }
                paint.textSize = 10f
                paint.letterSpacing = 0.05f
                drawContext.canvas.nativeCanvas.drawTextOnPath("कार्बन वॉलेट", bottom, 0f, 9f, paint)
            }
        }
    }
}

/**
 * The portal header, sized for a phone:
 *  1. tricolour hairline and the dark utility bar with text size (A / A+ / A++) and language, as GIGW asks;
 *  2. the white masthead: seal, the name in Hindi and English, which service this app is, and actions.
 */
@Composable
fun GovHeader(
    serviceEn: String,
    serviceHi: String,
    modifier: Modifier = Modifier,
    actions: @Composable () -> Unit = {},
) {
    Column(modifier.fillMaxWidth().background(Cw.govDeep).windowInsetsPadding(WindowInsets.statusBars)) {
        Tricolour()
        UtilityBar()
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(start = 12.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Seal(42.dp, withText = false)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("कार्बन वॉलेट", style = MaterialTheme.typography.titleMedium.copy(fontFamily = app.carbonwallet.core.ui.theme.Fonts.plexDeva), color = Cw.govNavy, maxLines = 1)
                    Text(
                        "  Carbon Wallet",
                        style = MaterialTheme.typography.titleMedium.copy(fontFamily = app.carbonwallet.core.ui.theme.Fonts.newsreader),
                        color = Cw.govNavy,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(t(serviceEn, serviceHi), style = MaterialTheme.typography.labelMedium, color = Cw.inkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            actions()
        }
        Box(Modifier.fillMaxWidth().height(3.dp).background(Cw.saffron))
    }
}

@Composable
fun UtilityBar() {
    Row(
        Modifier.fillMaxWidth().height(32.dp).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            t("Citizen Carbon Service", "नागरिक कार्बन सेवा"),
            color = Color.White.copy(alpha = 0.8f),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        val sizes = listOf("A" to t("Normal text", "सामान्य अक्षर"), "A+" to t("Larger text", "बड़े अक्षर"), "A++" to t("Largest text", "सबसे बड़े अक्षर"))
        sizes.forEachIndexed { i, (label, name) ->
            val on = UiPrefs.textSize == i
            Box(
                Modifier
                    .heightIn(min = 26.dp)
                    .background(if (on) Color.White else Color.Transparent, RoundedCornerShape(1.dp))
                    .clickable { UiPrefs.updateTextSize(i) }
                    .semantics {
                        role = Role.Tab
                        selected = on
                        contentDescription = name
                    }
                    .padding(horizontal = 7.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, color = if (on) Cw.govDeep else Color.White.copy(alpha = 0.85f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
        }
        Box(Modifier.padding(horizontal = 8.dp).width(1.dp).height(14.dp).background(Color.White.copy(alpha = 0.3f)))
        LanguageToggle()
    }
}

@Composable
fun LanguageToggle(light: Boolean = true) {
    val hi = UiPrefs.lang == Lang.HI
    val fg = if (light) Color.White else Cw.ink
    Row(
        Modifier
            .border(1.dp, fg.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
            .clickable { UiPrefs.updateLang(if (hi) Lang.EN else Lang.HI) }
            .semantics { contentDescription = if (hi) "Switch to English" else "हिंदी में देखें" }
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Lucide.Languages, null, tint = fg, modifier = Modifier.size(13.dp))
        Spacer(Modifier.width(5.dp))
        Text(if (hi) "English" else "हिंदी", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

@Composable
fun HeaderIcon(icon: ImageVector, description: String, onClick: () -> Unit, badge: Int = 0) {
    Box(
        Modifier
            .size(44.dp)
            .clickable(onClick = onClick)
            .semantics { contentDescription = if (badge > 0) "$description ($badge)" else description },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = Cw.govNavy, modifier = Modifier.size(22.dp))
        if (badge > 0) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 7.dp, end = 6.dp)
                    .heightIn(min = 16.dp)
                    .background(Cw.critical, CircleShape)
                    .padding(horizontal = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (badge > 9) "9+" else "$badge", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** "What's new" strip, as on public portals. Moving text can be paused, as accessibility rules ask. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Ticker(updates: List<PortalUpdate>, modifier: Modifier = Modifier, onOpen: (PortalUpdate) -> Unit = {}) {
    if (updates.isEmpty()) return
    var paused by remember { mutableStateOf(false) }
    val lang = UiPrefs.lang
    Row(
        modifier.fillMaxWidth().height(40.dp).background(Cw.govSky).border(1.dp, Cw.govNavy.copy(alpha = 0.12f)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.fillMaxHeight().background(Cw.saffron).padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
            Text(t("What's new", "नया क्या है"), color = Color.White, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
        }
        val line = updates.joinToString("     ◆     ") { lang.pick(it.en, it.hi) }
        Box(Modifier.weight(1f).fillMaxHeight().clickable { onOpen(updates.first()) }, contentAlignment = Alignment.CenterStart) {
            Text(
                line,
                color = Cw.govNavy,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                modifier = Modifier
                    .padding(start = 10.dp)
                    .then(if (paused) Modifier else Modifier.basicMarquee(iterations = Int.MAX_VALUE, initialDelayMillis = 800, velocity = 40.dp)),
            )
        }
        Box(
            Modifier
                .size(40.dp)
                .border(1.dp, Cw.govNavy.copy(alpha = 0.12f))
                .clickable { paused = !paused }
                .semantics { contentDescription = if (paused) "Play updates" else "Pause updates" },
            contentAlignment = Alignment.Center,
        ) {
            Icon(if (paused) Lucide.Play else Lucide.Pause, null, tint = Cw.govNavy, modifier = Modifier.size(15.dp))
        }
    }
}

/** A navy section band with a saffron rule, used for portal-style page titles. */
@Composable
fun PortalBand(title: String, subtitle: String? = null, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().background(Cw.govNavy).padding(horizontal = 16.dp, vertical = 14.dp)) {
            Text(title, color = Color.White, style = MaterialTheme.typography.headlineSmall)
            if (subtitle != null) Text(subtitle, color = Color.White.copy(alpha = 0.78f), style = MaterialTheme.typography.bodySmall)
        }
        Box(Modifier.fillMaxWidth().height(3.dp).background(Cw.saffron))
    }
}

@Composable
fun HelplineStrip(number: String, label: String, onCall: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Cw.saffronSoft, CardShape)
            .border(1.dp, Cw.saffron.copy(alpha = 0.35f), CardShape)
            .clickable(onClick = onCall)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Lucide.Phone, null, tint = Cw.warningText, modifier = Modifier.size(18.dp))
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = Cw.warningText)
            Text(number, style = MaterialTheme.typography.titleMedium, color = Cw.ink)
        }
        Text(t("Call", "कॉल करें"), style = MaterialTheme.typography.labelLarge, color = Cw.govBlue)
    }
}
