package app.carbonwallet.dukaan

import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.LocalActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.carbonwallet.core.ui.theme.Cw
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/**
 * Live camera preview that reads the Carbon Card's Code 128 barcode (or a QR) on the phone with ML Kit:
 * no network, no photo saved. [onCode] gets each value read; the caller ignores repeats.
 */
@Composable
fun BarcodeScanner(onCode: (String) -> Unit, torch: Boolean, modifier: Modifier = Modifier, onUnavailable: () -> Unit = {}) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val latest by rememberUpdatedState(onCode)
    val unavailable by rememberUpdatedState(onUnavailable)
    var camera by remember { mutableStateOf<Camera?>(null) }
    val previewView = remember {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        }
    }

    DisposableEffect(owner) {
        // a phone whose camera or barcode reader can't start falls back to typing the code, never a crash
        val scanner = runCatching {
            BarcodeScanning.getClient(
                BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_CODE_128, Barcode.FORMAT_QR_CODE).build(),
            )
        }.getOrElse {
            unavailable()
            return@DisposableEffect onDispose {}
        }
        val executor = Executors.newSingleThreadExecutor()
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        future.addListener({
            val p = runCatching { future.get() }.getOrElse {
                unavailable()
                return@addListener
            }
            provider = p
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
            analysis.setAnalyzer(executor) { proxy ->
                val media = proxy.image
                if (media == null) {
                    proxy.close()
                    return@setAnalyzer
                }
                scanner.process(InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees))
                    .addOnSuccessListener { codes -> codes.firstNotNullOfOrNull { it.rawValue }?.let { latest(it) } }
                    .addOnCompleteListener { proxy.close() }
            }
            runCatching {
                p.unbindAll()
                camera = p.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            }.onFailure { unavailable() }
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            provider?.unbindAll()
            scanner.close()
            executor.shutdown()
        }
    }
    LaunchedEffect(camera, torch) { camera?.cameraControl?.enableTorch(torch) }

    AndroidView({ previewView }, modifier)
}

/** Corner brackets and a sweeping line over the preview, so it's clear where to hold the card. */
@Composable
fun ScanFrame(modifier: Modifier = Modifier) {
    val sweep by rememberInfiniteTransition(label = "sweep").animateFloat(
        0.15f, 0.85f, infiniteRepeatable(tween(1600, easing = LinearEasing), RepeatMode.Reverse), label = "line",
    )
    Canvas(modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val boxW = w * 0.8f
        val boxH = h * 0.5f
        val left = (w - boxW) / 2
        val top = (h - boxH) / 2
        val arm = boxW * 0.12f
        val stroke = 6f
        val c = Color.White
        listOf(
            Offset(left, top) to Pair(Offset(arm, 0f), Offset(0f, arm)),
            Offset(left + boxW, top) to Pair(Offset(-arm, 0f), Offset(0f, arm)),
            Offset(left, top + boxH) to Pair(Offset(arm, 0f), Offset(0f, -arm)),
            Offset(left + boxW, top + boxH) to Pair(Offset(-arm, 0f), Offset(0f, -arm)),
        ).forEach { (corner, arms) ->
            drawLine(c, corner, corner + arms.first, stroke, StrokeCap.Round)
            drawLine(c, corner, corner + arms.second, stroke, StrokeCap.Round)
        }
        val y = top + boxH * sweep
        drawLine(Cw.saffron, Offset(left + 12f, y), Offset(left + boxW - 12f, y), 4f, StrokeCap.Round)
    }
}

/**
 * While the counter screen is open, a Carbon Card tapped on the phone is read over NFC: the text record
 * holds the same code as the barcode; a card without one is identified by its chip serial, which the
 * website matches to the paired home.
 */
@Composable
fun NfcCardReader(enabled: Boolean, onRead: (String) -> Unit) {
    val activity = LocalActivity.current ?: return
    val adapter = remember(activity) { NfcAdapter.getDefaultAdapter(activity) } ?: return
    val latest by rememberUpdatedState(onRead)
    DisposableEffect(enabled, adapter) {
        if (!enabled || !adapter.isEnabled) return@DisposableEffect onDispose {}
        val main = Handler(Looper.getMainLooper())
        adapter.enableReaderMode(
            activity,
            { tag -> readCard(tag)?.let { value -> main.post { latest(value) } } },
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V,
            null,
        )
        onDispose { runCatching { adapter.disableReaderMode(activity) } }
    }
}

fun nfcAvailable(activity: android.app.Activity?): Boolean = activity != null && NfcAdapter.getDefaultAdapter(activity) != null

private fun readCard(tag: Tag): String? {
    val text = runCatching {
        Ndef.get(tag)?.cachedNdefMessage?.records?.firstNotNullOfOrNull { record ->
            if (record.tnf == NdefRecord.TNF_WELL_KNOWN && record.type.contentEquals(NdefRecord.RTD_TEXT)) {
                val payload = record.payload
                val langLength = payload[0].toInt() and 0x3F
                String(payload, 1 + langLength, payload.size - 1 - langLength, Charsets.UTF_8)
            } else {
                record.toUri()?.toString()
            }
        }
    }.getOrNull()
    return text?.trim()?.takeIf { it.isNotEmpty() } ?: tag.id?.joinToString(":") { "%02X".format(it) }
}
