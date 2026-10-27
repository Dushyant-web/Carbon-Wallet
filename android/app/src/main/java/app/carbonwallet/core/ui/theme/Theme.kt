package app.carbonwallet.core.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.carbonwallet.R
import app.carbonwallet.core.ui.Lang
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.UiPrefs

/** "Carbon Ledger" tokens, copied from the website's tailwind.config.ts so both look the same. */
object Cw {
    val ink = Color(0xFF1D1C18)
    val inkMuted = Color(0xFF625D54)
    val inkLight = Color(0xFF8F897D)
    val canvas = Color(0xFFF4F1EA)
    val card = Color(0xFFFBFAF7)
    val subtle = Color(0xFFECE7DC)
    val border = Color(0xFFDCD5C6)
    val borderHover = Color(0xFFC4BBA8)

    val terracotta = Color(0xFFB4532F)
    val terracottaSoft = Color(0xFFF0D5C8)
    val moss = Color(0xFF3F6B4E)
    val mossSoft = Color(0xFFE3EADF)

    val success = Color(0xFF3F6B4E)
    val successSoft = Color(0xFFE6ECE2)
    val successText = Color(0xFF2C4D37)
    val successBorder = Color(0xFFBFCFB8)
    val warning = Color(0xFFB7862B)
    val warningSoft = Color(0xFFF6EDD8)
    val warningText = Color(0xFF7A5716)
    val warningBorder = Color(0xFFE5CF9C)
    val critical = Color(0xFFA3362A)
    val criticalSoft = Color(0xFFF5E1DC)
    val criticalText = Color(0xFF7E2419)
    val criticalBorder = Color(0xFFE3B6AC)

    // public-portal chrome: navy with saffron and India green accents
    val govNavy = Color(0xFF12284C)
    val govDeep = Color(0xFF0B1B36)
    val govBlue = Color(0xFF1F4E8C)
    val govSky = Color(0xFFE9EFF8)
    val saffron = Color(0xFFF28C28)
    val saffronSoft = Color(0xFFFDEBD9)
    val indiaGreen = Color(0xFF138808)
    val tricolourSaffron = Color(0xFFFF9933)

    // data-viz categories
    val vizElectricity = Color(0xFFB4532F)
    val vizTransport = Color(0xFF2F5D7C)
    val vizFood = Color(0xFF9A7B2E)
    val vizCooking = Color(0xFF6E5A8A)
    val vizWaste = Color(0xFF5A7D52)
    val vizFlights = Color(0xFF48443B)
    val vizOther = Color(0xFFA49C8B)

    fun category(name: String): Color = when (name.lowercase()) {
        "electricity" -> vizElectricity
        "transport" -> vizTransport
        "food" -> vizFood
        "cooking" -> vizCooking
        "waste" -> vizWaste
        "travel", "flights" -> vizFlights
        else -> vizOther
    }
}

object Fonts {
    val plexSans = FontFamily(
        Font(R.font.plex_sans_regular, FontWeight.Normal),
        Font(R.font.plex_sans_medium, FontWeight.Medium),
        Font(R.font.plex_sans_semibold, FontWeight.SemiBold),
        Font(R.font.plex_sans_semibold, FontWeight.Bold),
    )
    /** Plex Devanagari also carries Latin letters, so mixed Hindi + English text stays in one typeface. */
    val plexDeva = FontFamily(
        Font(R.font.plex_deva_regular, FontWeight.Normal),
        Font(R.font.plex_deva_regular, FontWeight.Medium),
        Font(R.font.plex_deva_semibold, FontWeight.SemiBold),
        Font(R.font.plex_deva_semibold, FontWeight.Bold),
    )
    val newsreader = FontFamily(
        Font(R.font.newsreader_medium, FontWeight.Medium),
        Font(R.font.newsreader_semibold, FontWeight.SemiBold),
        Font(R.font.newsreader_semibold, FontWeight.Bold),
    )
    val mono = FontFamily(Font(R.font.plex_mono_medium, FontWeight.Medium))
}

private fun typography(lang: Lang): Typography {
    val body = if (lang == Lang.HI) Fonts.plexDeva else Fonts.plexSans
    // Newsreader has no Devanagari, so Hindi headings use Plex Devanagari like the website does
    val heading = if (lang == Lang.HI) Fonts.plexDeva else Fonts.newsreader
    fun s(family: FontFamily, size: Int, line: Int, weight: FontWeight, tracking: Double = 0.0) =
        // no colour here: text takes its colour from the surface it sits on (ink on paper, paper on buttons)
        TextStyle(fontFamily = family, fontSize = size.sp, lineHeight = line.sp, fontWeight = weight, letterSpacing = tracking.sp)
    return Typography(
        displayLarge = s(heading, 44, 50, FontWeight.SemiBold, -0.5),
        displayMedium = s(heading, 36, 42, FontWeight.SemiBold, -0.4),
        displaySmall = s(heading, 30, 36, FontWeight.SemiBold, -0.3),
        headlineLarge = s(heading, 28, 34, FontWeight.SemiBold, -0.2),
        headlineMedium = s(heading, 24, 30, FontWeight.SemiBold, -0.2),
        headlineSmall = s(heading, 21, 27, FontWeight.SemiBold),
        titleLarge = s(heading, 19, 25, FontWeight.SemiBold),
        titleMedium = s(body, 16, 22, FontWeight.SemiBold),
        titleSmall = s(body, 14, 20, FontWeight.SemiBold),
        bodyLarge = s(body, 16, 24, FontWeight.Normal),
        bodyMedium = s(body, 14, 21, FontWeight.Normal),
        bodySmall = s(body, 12, 17, FontWeight.Normal),
        labelLarge = s(body, 14, 20, FontWeight.Medium),
        labelMedium = s(body, 12, 16, FontWeight.Medium, 0.2),
        labelSmall = s(body, 11, 14, FontWeight.Medium, 0.4),
    )
}

private val colors = lightColorScheme(
    primary = Cw.ink,
    onPrimary = Cw.card,
    primaryContainer = Cw.subtle,
    onPrimaryContainer = Cw.ink,
    secondary = Cw.terracotta,
    onSecondary = Color.White,
    secondaryContainer = Cw.terracottaSoft,
    onSecondaryContainer = Cw.ink,
    tertiary = Cw.moss,
    onTertiary = Color.White,
    tertiaryContainer = Cw.mossSoft,
    onTertiaryContainer = Cw.ink,
    background = Cw.canvas,
    onBackground = Cw.ink,
    surface = Cw.card,
    onSurface = Cw.ink,
    surfaceVariant = Cw.subtle,
    onSurfaceVariant = Cw.inkMuted,
    surfaceContainer = Cw.card,
    surfaceContainerLow = Cw.card,
    surfaceContainerHigh = Cw.card,
    surfaceContainerHighest = Cw.subtle,
    surfaceContainerLowest = Color.White,
    outline = Cw.border,
    outlineVariant = Cw.border,
    error = Cw.critical,
    onError = Color.White,
    errorContainer = Cw.criticalSoft,
    onErrorContainer = Cw.criticalText,
    inverseSurface = Cw.ink,
    inverseOnSurface = Cw.card,
)

// Near-square corners, as on the website (2–4 px)
private val shapes = Shapes(
    extraSmall = RoundedCornerShape(2.dp),
    small = RoundedCornerShape(2.dp),
    medium = RoundedCornerShape(3.dp),
    large = RoundedCornerShape(4.dp),
    extraLarge = RoundedCornerShape(6.dp),
)

/** Text size A / A+ / A++, the same three steps as the website's utility bar. */
val TEXT_SCALES = floatArrayOf(1f, 1.12f, 1.25f)

@Composable
fun CwTheme(content: @Composable () -> Unit) {
    val lang = UiPrefs.lang
    val density = LocalDensity.current
    val scaled = Density(density.density, density.fontScale * TEXT_SCALES[UiPrefs.textSize.coerceIn(0, 2)])
    CompositionLocalProvider(LocalLang provides lang, LocalDensity provides scaled) {
        MaterialTheme(colorScheme = colors, typography = typography(lang), shapes = shapes, content = content)
    }
}
