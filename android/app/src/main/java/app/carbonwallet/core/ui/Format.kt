package app.carbonwallet.core.ui

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

private val indian = Locale.Builder().setLanguage("en").setRegion("IN").build()

/** ₹46,01,560 — Indian digit grouping, no paise. */
fun rupees(value: Double?): String {
    if (value == null) return "—"
    return "₹" + NumberFormat.getIntegerInstance(indian).format(value.roundToInt())
}

fun count(value: Int): String = NumberFormat.getIntegerInstance(indian).format(value)

/** 288.6 → "289 kg", 12.4 → "12.4 kg", 1500 → "1.5 t". */
fun kg(value: Double?): String {
    if (value == null) return "—"
    val a = abs(value)
    return when {
        a >= 1000 -> String.format(indian, "%.1f t", value / 1000)
        a >= 100 -> "${value.roundToInt()} kg"
        else -> String.format(indian, "%.1f kg", value)
    }
}

fun kgNumber(value: Double): String = if (abs(value) >= 100) "${value.roundToInt()}" else String.format(indian, "%.1f", value)

fun pct(value: Double?): String = if (value == null) "—" else "${abs(value).roundToInt()}%"

private val dayMonth = DateTimeFormatter.ofPattern("d MMM", indian)
private val dayMonthYear = DateTimeFormatter.ofPattern("d MMM yyyy", indian)

/** "2026-09-30" or an ISO instant → "30 Sep 2026". */
fun date(value: String?): String {
    if (value.isNullOrBlank()) return "—"
    return runCatching { LocalDate.parse(value.take(10)).format(dayMonthYear) }.getOrDefault(value.take(10))
}

fun shortDate(value: String?): String {
    if (value.isNullOrBlank()) return "—"
    return runCatching { LocalDate.parse(value.take(10)).format(dayMonth) }.getOrDefault(value.take(10))
}

/** "5 min ago", "3 h ago", "2 days ago", then a date. */
fun ago(iso: String?, lang: Lang): String {
    if (iso.isNullOrBlank()) return ""
    val then = runCatching { Instant.parse(iso) }.getOrNull() ?: return date(iso)
    val minutes = ChronoUnit.MINUTES.between(then, Instant.now())
    return when {
        minutes < 1 -> lang.pick("just now", "अभी")
        minutes < 60 -> lang.pick("$minutes min ago", "$minutes मिनट पहले")
        minutes < 60 * 24 -> lang.pick("${minutes / 60} h ago", "${minutes / 60} घंटे पहले")
        minutes < 60 * 24 * 7 -> lang.pick("${minutes / 1440} days ago", "${minutes / 1440} दिन पहले")
        else -> then.atZone(ZoneId.systemDefault()).toLocalDate().format(dayMonthYear)
    }
}

/** "2026-03" → "Mar 2026" */
fun monthLabel(month: String?): String {
    if (month.isNullOrBlank()) return "—"
    return runCatching { LocalDate.parse("$month-01").format(DateTimeFormatter.ofPattern("MMM yyyy", indian)) }.getOrDefault(month)
}
