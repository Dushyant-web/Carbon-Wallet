package app.carbonwallet.core.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Code 128 (set B), ported from the website's src/lib/code128.ts so the phone shows the same barcode
 * a shop's scanner already reads from the printed card.
 */
object Code128 {
    private val PATTERNS = arrayOf(
        "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
        "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
        "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
        "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
        "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
        "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
        "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
        "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
        "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
        "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
        "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
    )
    private const val START_B = 104
    private const val STOP = 106
    const val QUIET_ZONE = 10

    fun values(text: String): List<Int> {
        val values = mutableListOf(START_B)
        for (ch in text) {
            require(ch.code in 32..126) { "Code 128-B can't encode '$ch'" }
            values += ch.code - 32
        }
        val check = values.foldIndexed(0) { i, sum, v -> sum + v * (if (i == 0) 1 else i) } % 103
        return values + check + STOP
    }

    /** Module widths, alternating bar/space, starting with a bar. */
    fun widths(text: String): List<Int> = values(text).flatMap { v -> PATTERNS[v].map { it.digitToInt() } }
}

@Composable
fun Barcode(text: String, modifier: Modifier = Modifier, height: Dp = 72.dp, color: Color = Color.Black) {
    val widths = remember(text) { runCatching { Code128.widths(text) }.getOrDefault(emptyList()) }
    Canvas(modifier.fillMaxWidth().height(height).semantics { contentDescription = "Barcode $text" }) {
        if (widths.isEmpty()) return@Canvas
        val total = widths.sum() + 2 * Code128.QUIET_ZONE
        val module = size.width / total
        var x = Code128.QUIET_ZONE * module
        widths.forEachIndexed { i, w ->
            if (i % 2 == 0) drawRect(color, Offset(x, 0f), Size(w * module, size.height))
            x += w * module
        }
    }
}

/** "CW1BMRWH89ZYEAN" → "CW1-BMRW-H89Z-YEAN", the way it's printed under the barcode. */
fun formatCardCode(code: String): String {
    val c = code.replace("-", "")
    if (c.length <= 3) return c
    return (listOf(c.take(3)) + c.drop(3).chunked(4)).joinToString("-")
}
