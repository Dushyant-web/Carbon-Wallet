package app.carbonwallet

import android.app.Application
import android.os.Build
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Session
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.ui.UiPrefs
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade

class CwApplication : Application(), SingletonImageLoader.Factory {
    override fun onCreate() {
        super.onCreate()
        UiPrefs.init(this)
        Store.init(this)
        Http.init(this, "CarbonWallet-${BuildConfig.ROLE}/${BuildConfig.VERSION_NAME} (Android ${Build.VERSION.RELEASE})")
        Session.init(this)
    }

    /** Images (catalogue photos, removal photos) go through the same client, so they carry the session too. */
    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { Http.client })) }
            .crossfade(true)
            .build()
}
