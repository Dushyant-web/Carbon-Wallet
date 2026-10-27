package app.carbonwallet.core.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import app.carbonwallet.core.net.Remote
import app.carbonwallet.core.ui.theme.Cw

val CardShape = RoundedCornerShape(3.dp)

/** Traffic-light tone. Always shown with an icon and a word, never colour alone. */
enum class Tone(val fg: Color, val bg: Color, val border: Color) {
    GOOD(Cw.successText, Cw.successSoft, Cw.successBorder),
    WARN(Cw.warningText, Cw.warningSoft, Cw.warningBorder),
    BAD(Cw.criticalText, Cw.criticalSoft, Cw.criticalBorder),
    INFO(Cw.govNavy, Cw.govSky, Color(0xFFC9D6EA)),
    NEUTRAL(Cw.inkMuted, Cw.subtle, Cw.border);

    val icon: ImageVector
        get() = when (this) {
            GOOD -> Lucide.CircleCheck
            WARN -> Lucide.Alert
            BAD -> Lucide.CircleX
            INFO -> Lucide.Info
            NEUTRAL -> Lucide.Clock
        }

    companion object {
        fun ofColour(colour: String?): Tone = when (colour?.uppercase()) {
            "GREEN" -> GOOD
            "AMBER" -> WARN
            "RED" -> BAD
            else -> NEUTRAL
        }
    }
}

/** A flat card with a hairline border: the website's "tier-1" surface. */
@Composable
fun CwCard(
    modifier: Modifier = Modifier,
    background: Color = Cw.card,
    border: Color = Cw.border,
    padding: Dp = 16.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .background(background, CardShape)
            .border(1.dp, border, CardShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

/** Small uppercase label above a section, as on the website's cards. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, color: Color = Cw.inkMuted) {
    Text(text.uppercase(), modifier = modifier, style = MaterialTheme.typography.labelSmall, color = color, letterSpacing = 1.sp)
}

@Composable
fun SectionHeader(title: String, hint: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            if (hint != null) Text(hint, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
        }
        action?.invoke()
    }
}

@Composable
fun StatusPill(tone: Tone, text: String, modifier: Modifier = Modifier, large: Boolean = false) {
    Row(
        modifier
            .background(tone.bg, RoundedCornerShape(2.dp))
            .border(1.dp, tone.border, RoundedCornerShape(2.dp))
            .padding(horizontal = if (large) 12.dp else 8.dp, vertical = if (large) 8.dp else 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(tone.icon, null, tint = tone.fg, modifier = Modifier.size(if (large) 18.dp else 14.dp))
        Spacer(Modifier.width(6.dp))
        Text(text, color = tone.fg, style = if (large) MaterialTheme.typography.titleSmall else MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun Tag(text: String, modifier: Modifier = Modifier, color: Color = Cw.inkMuted, background: Color = Cw.subtle) {
    Text(
        text,
        modifier = modifier.background(background, RoundedCornerShape(2.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        maxLines = 1,
    )
}

@Composable
fun KpiTile(label: String, value: String, modifier: Modifier = Modifier, sub: String? = null, icon: ImageVector? = null, accent: Color = Cw.ink) {
    Column(
        modifier
            .background(Cw.card, CardShape)
            .border(1.dp, Cw.border, CardShape)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, null, tint = Cw.inkMuted, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text(label, style = MaterialTheme.typography.labelMedium, color = Cw.inkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(6.dp))
        Text(value, style = MaterialTheme.typography.headlineMedium, color = accent, maxLines = 1)
        if (sub != null) Text(sub, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted, maxLines = 2)
    }
}

/** Two tiles per row. */
@Composable
fun TileRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), content = content)
}

@Composable
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier, valueColor: Color = Cw.ink) {
    Row(modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(12.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = valueColor, modifier = Modifier.weight(1.3f))
    }
}

@Composable
fun Hairline(modifier: Modifier = Modifier) = HorizontalDivider(modifier, thickness = 1.dp, color = Cw.border)

/** List row with an icon square, title, subtitle and an optional trailing element. */
@Composable
fun ListRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector? = null,
    iconTint: Color = Cw.ink,
    iconBg: Color = Cw.subtle,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .heightIn(min = 56.dp)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Box(Modifier.size(40.dp).background(iconBg, RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = iconTint, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!subtitle.isNullOrBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
        if (trailing != null) {
            Spacer(Modifier.width(8.dp))
            trailing()
        } else if (onClick != null) {
            Icon(Lucide.ChevronRight, null, tint = Cw.inkLight, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    busy: Boolean = false,
    color: Color = Cw.ink,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !busy,
        modifier = modifier.heightIn(min = 52.dp),
        shape = RoundedCornerShape(3.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color, contentColor = Cw.card, disabledContainerColor = color.copy(alpha = 0.45f), disabledContentColor = Cw.card),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 12.dp),
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(18.dp), color = Cw.card, strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, enabled: Boolean = true, color: Color = Cw.ink) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 48.dp),
        shape = RoundedCornerShape(3.dp),
        border = BorderStroke(1.dp, if (enabled) color.copy(alpha = 0.6f) else Cw.border),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = color),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
    ) {
        if (icon != null) {
            Icon(icon, null, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun LinkButton(text: String, onClick: () -> Unit, icon: ImageVector? = null, color: Color = Cw.govBlue) {
    TextButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp)) {
        Text(text, color = color, style = MaterialTheme.typography.labelLarge)
        if (icon != null) {
            Spacer(Modifier.width(4.dp))
            Icon(icon, null, tint = color, modifier = Modifier.size(15.dp))
        }
    }
}

@Composable
fun CwTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
    supporting: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    visual: VisualTransformation? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine,
        minLines = minLines,
        leadingIcon = icon?.let { { Icon(it, null, modifier = Modifier.size(18.dp)) } },
        trailingIcon = trailing,
        supportingText = supporting?.let { { Text(it) } },
        visualTransformation = visual ?: if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(3.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Cw.ink,
            unfocusedBorderColor = Cw.border,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            focusedLabelColor = Cw.ink,
            cursorColor = Cw.ink,
        ),
    )
}

/** Grey placeholder blocks that pulse while the first data loads. */
@Composable
fun Skeleton(modifier: Modifier = Modifier, height: Dp = 16.dp) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(0.45f, 0.9f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "alpha")
    Box(modifier.fillMaxWidth().height(height).alpha(alpha).background(Cw.subtle, RoundedCornerShape(2.dp)))
}

@Composable
fun SkeletonScreen() {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Skeleton(Modifier.width(140.dp), 14.dp)
        Skeleton(height = 150.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Skeleton(Modifier.weight(1f), 84.dp)
            Skeleton(Modifier.weight(1f), 84.dp)
        }
        Skeleton(height = 180.dp)
        Skeleton(height = 64.dp)
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, body: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(vertical = 32.dp, horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(56.dp).background(Cw.subtle, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Cw.inkMuted, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (body != null) {
            Spacer(Modifier.height(4.dp))
            Text(body, style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
        if (action != null) {
            Spacer(Modifier.height(14.dp))
            action()
        }
    }
}

@Composable
fun Banner(tone: Tone, text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Row(
        modifier.fillMaxWidth().background(tone.bg, CardShape).border(1.dp, tone.border, CardShape).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(tone.icon, null, tint = tone.fg, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, color = tone.fg, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        action?.invoke()
    }
}

/**
 * The standard screen body: pull to refresh, a skeleton on the very first load, an error with "try again"
 * when there's nothing cached, and a quiet banner when showing saved data because the network failed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> RemoteList(
    remote: Remote<T>,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    contentPadding: PaddingValues = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 28.dp),
    content: LazyListScope.(T) -> Unit,
) {
    val data = remote.data
    PullToRefreshBox(isRefreshing = remote.loading && data != null, onRefresh = remote.refresh, modifier = modifier.fillMaxSize()) {
        when {
            data != null -> LazyColumn(Modifier.fillMaxSize(), state = state, contentPadding = contentPadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (remote.error != null) {
                    item(key = "offline") { Banner(Tone.WARN, offlineText(remote.error), action = { LinkButton(t("Retry", "फिर से"), remote.refresh) }) }
                }
                content(data)
            }
            remote.error != null -> LazyColumn(Modifier.fillMaxSize()) {
                item {
                    EmptyState(Lucide.Alert, t("Couldn't load", "लोड नहीं हुआ"), remote.error, action = {
                        PrimaryButton(t("Try again", "फिर कोशिश करें"), remote.refresh, icon = Lucide.Refresh)
                    })
                }
            }
            else -> SkeletonScreen()
        }
    }
}

@Composable
private fun offlineText(error: String) = t("Showing saved data. $error", "सहेजा हुआ डेटा दिख रहा है। $error")
