package app.carbonwallet.core.shell

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.FlavorSpec
import app.carbonwallet.core.model.NotificationsPage
import app.carbonwallet.core.net.AuthState
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.ui.GovHeader
import app.carbonwallet.core.ui.HeaderIcon
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.Seal
import app.carbonwallet.core.ui.UiPrefs
import app.carbonwallet.core.ui.pick
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw

@Composable
fun CwApp(flavor: FlavorSpec) {
    val auth by Session.state.collectAsState()
    when (val state = auth) {
        AuthState.Checking -> Checking()
        AuthState.SignedOut -> LoginScreen(flavor)
        is AuthState.SignedIn -> SignedInShell(flavor, state)
    }
}

@Composable
private fun Checking() {
    LaunchedEffect(Unit) { runCatching { Session.refreshMe() } }
    Box(Modifier.fillMaxSize().background(Cw.govNavy), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Seal(96.dp)
            Spacer(Modifier.height(20.dp))
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        }
    }
}

@Composable
private fun SignedInShell(flavor: FlavorSpec, state: AuthState.SignedIn) {
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val stack = remember { mutableStateListOf<Page>() }
    val nav = remember { Nav(stack, { tab = it }, snackbar, scope) }
    val tabs = flavor.tabs
    val saveable = rememberSaveableStateHolder()

    // warm every tab's data in parallel, and re-check the account in the background
    LaunchedEffect(state.me.user.id) {
        Store.prefetch(scope, flavor.prefetch(state.me))
        runCatching { Session.refreshMe() }
    }

    BackHandler(enabled = stack.isNotEmpty()) { nav.pop() }
    BackHandler(enabled = stack.isEmpty() && tab != 0) { tab = 0 }

    val notifications = rememberRemote("/api/notifications", NotificationsPage.serializer())
    val unread = notifications.data?.unread ?: 0

    CompositionLocalProvider(LocalNav provides nav) {
        Scaffold(
            containerColor = Cw.canvas,
            contentWindowInsets = WindowInsets(0),
            topBar = {
                GovHeader(flavor.serviceEn, flavor.serviceHi) {
                    HeaderIcon(Lucide.Bell, t("Notifications", "सूचनाएँ"), onClick = {
                        nav.push("Notifications", "सूचनाएँ") { NotificationsScreen() }
                    }, badge = unread)
                    HeaderIcon(Lucide.User, t("Profile and settings", "प्रोफ़ाइल और सेटिंग"), onClick = {
                        nav.push("Profile", "प्रोफ़ाइल") { ProfileScreen(flavor) }
                    })
                }
            },
            bottomBar = { if (stack.isEmpty()) BottomBar(flavor, tab) { tab = it } },
            snackbarHost = {
                SnackbarHost(snackbar) { data ->
                    Snackbar(data, shape = RoundedCornerShape(3.dp), containerColor = Cw.ink, contentColor = Cw.card, actionColor = Cw.saffron)
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                // (top page, depth): a deeper stack means "forward", so pages slide in and fade back out
                AnimatedContent(
                    targetState = stack.lastOrNull() to stack.size,
                    transitionSpec = {
                        if (targetState.second > initialState.second) {
                            (slideInHorizontally(tween(220)) { it / 5 } + fadeIn(tween(220))) togetherWith fadeOut(tween(120))
                        } else {
                            fadeIn(tween(180)) togetherWith (slideOutHorizontally(tween(200)) { it / 5 } + fadeOut(tween(160)))
                        }
                    },
                    label = "page",
                ) { (page, _) ->
                    if (page != null) {
                        PageFrame(page, nav)
                    } else {
                        saveable.SaveableStateProvider(key = "tab-$tab") { tabs[tab.coerceIn(0, tabs.lastIndex)].content(nav) }
                    }
                }
            }
        }
    }
}

@Composable
private fun PageFrame(page: Page, nav: Nav) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Cw.card)
                .clickable { nav.pop() }
                .padding(horizontal = 8.dp, vertical = 4.dp)
                .height(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.Back, t("Back", "वापस"), tint = Cw.ink, modifier = Modifier.padding(8.dp).size(22.dp))
            Text(UiPrefs.lang.pick(page.en, page.hi), style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Cw.border))
        Box(Modifier.weight(1f)) { page.content(nav) }
    }
}

@Composable
private fun BottomBar(flavor: FlavorSpec, selected: Int, onSelect: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth().background(Cw.card).windowInsetsPadding(WindowInsets.navigationBars)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Cw.border))
        Row(Modifier.fillMaxWidth().height(66.dp)) {
            flavor.tabs.forEachIndexed { i, tab ->
                val on = i == selected
                Column(
                    Modifier
                        .weight(1f)
                        .clickable { onSelect(i) }
                        .semantics {
                            role = Role.Tab
                            this.selected = on
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // the active tab gets a saffron rule on top, like the portal menu
                    Box(Modifier.fillMaxWidth(0.6f).height(3.dp).background(if (on) Cw.saffron else Color.Transparent))
                    Spacer(Modifier.height(8.dp))
                    Box(
                        Modifier.background(if (on) Cw.govSky else Color.Transparent, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 3.dp),
                    ) {
                        Icon(tab.icon, null, tint = if (on) Cw.govNavy else Cw.inkMuted, modifier = Modifier.size(21.dp))
                    }
                    Spacer(Modifier.height(3.dp))
                    Text(
                        t(tab.en, tab.hi),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (on) Cw.govNavy else Cw.inkMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 2.dp),
                    )
                }
            }
        }
    }
}
