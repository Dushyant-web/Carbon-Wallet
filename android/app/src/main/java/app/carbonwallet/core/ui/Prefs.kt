package app.carbonwallet.core.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import java.util.Locale

enum class Lang { EN, HI }

val LocalLang = staticCompositionLocalOf { Lang.EN }

/** Display preferences kept on the phone: language and text size, like the website's utility bar. */
object UiPrefs {
    private lateinit var prefs: SharedPreferences

    var lang by mutableStateOf(Lang.EN)
        private set
    var textSize by mutableIntStateOf(0)
        private set

    fun init(context: Context) {
        prefs = context.getSharedPreferences("cw_ui", Context.MODE_PRIVATE)
        val saved = prefs.getString("lang", null)
        lang = when {
            saved != null -> runCatching { Lang.valueOf(saved) }.getOrDefault(Lang.EN)
            Locale.getDefault().language == "hi" -> Lang.HI
            else -> Lang.EN
        }
        textSize = prefs.getInt("size", 0).coerceIn(0, 2)
    }

    fun updateLang(value: Lang) {
        lang = value
        prefs.edit().putString("lang", value.name).apply()
    }

    fun updateTextSize(value: Int) {
        textSize = value.coerceIn(0, 2)
        prefs.edit().putInt("size", textSize).apply()
    }
}

/** Picks the Hindi or English wording for the current language. */
@Composable
@ReadOnlyComposable
fun t(en: String, hi: String): String = if (LocalLang.current == Lang.HI) hi else en

fun Lang.pick(en: String, hi: String?): String = if (this == Lang.HI && !hi.isNullOrBlank()) hi else en
