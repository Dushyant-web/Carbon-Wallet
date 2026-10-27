package app.carbonwallet.core.shell

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** A screen opened on top of the tabs, with its own title and a back arrow. */
class Page(val en: String, val hi: String, val content: @Composable (Nav) -> Unit)

/**
 * Tiny navigator: tabs at the bottom, a stack of pages on top. Kept in-house instead of a navigation library
 * so there is nothing to start up and every hop is a state change.
 */
class Nav internal constructor(
    private val stack: SnapshotStateList<Page>,
    private val selectTab: (Int) -> Unit,
    private val snackbar: SnackbarHostState,
    private val scope: CoroutineScope,
) {
    fun push(en: String, hi: String, content: @Composable (Nav) -> Unit) {
        stack.add(Page(en, hi, content))
    }

    fun pop(): Boolean {
        if (stack.isEmpty()) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    fun tab(index: Int) {
        stack.clear()
        selectTab(index)
    }

    /** A Material snackbar in the theme's tone; [undo] adds an action button. */
    fun toast(message: String, action: String? = null, undo: (() -> Unit)? = null) {
        scope.launch {
            snackbar.currentSnackbarData?.dismiss()
            val result = snackbar.showSnackbar(message, actionLabel = action, withDismissAction = action == null, duration = SnackbarDuration.Short)
            if (result == SnackbarResult.ActionPerformed) undo?.invoke()
        }
    }
}

val LocalNav = compositionLocalOf<Nav> { error("No Nav") }
