import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

/** Settings that differ per machine or per deployment: Gradle -P flags first, then android/local.properties. */
val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun setting(name: String): String? =
    (findProperty(name) as String?)?.takeIf { it.isNotBlank() } ?: localProps.getProperty(name)?.takeIf { it.isNotBlank() }

fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

/** Release signing comes from android/keystore.properties, which is never committed. */
val keystoreProps = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

android {
    namespace = "app.carbonwallet"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        // Google sign-in (Ghar and Dukaan): the *web* OAuth client ID the server checks tokens against. Empty hides the button.
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", quoted(setting("cw.googleWebClientId") ?: ""))
        // Demo/judging builds: one-tap demo logins on the sign-in screen (like the website's NEXT_PUBLIC_SHOW_DEMO)
        buildConfigField("boolean", "SHOW_DEMO", (setting("cw.showDemo") == "true").toString())
    }

    flavorDimensions += "role"
    productFlavors {
        create("ghar") {
            dimension = "role"
            applicationId = "in.carbonwallet.ghar"
            buildConfigField("String", "ROLE", quoted("HOUSEHOLD"))
        }
        create("dukaan") {
            dimension = "role"
            applicationId = "in.carbonwallet.dukaan"
            buildConfigField("String", "ROLE", quoted("MERCHANT"))
            // the bundled barcode reader carries native code per CPU; shop phones are ARM, so skip the x86 copies
            ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
        }
        create("admin") {
            dimension = "role"
            applicationId = "in.carbonwallet.admin"
            buildConfigField("String", "ROLE", quoted("ADMIN"))
        }
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_URL", quoted(setting("cw.apiUrl") ?: "http://10.0.2.2:3000"))
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Left empty when not set: the app then says the server isn't configured instead of calling a wrong host.
            buildConfigField("String", "API_URL", quoted(setting("cw.releaseApiUrl") ?: ""))
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        // Google sign-in code is shared by the two apps that offer it
        getByName("ghar").kotlin.srcDir("src/google/java")
        getByName("dukaan").kotlin.srcDir("src/google/java")
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "/META-INF/*.version", "DebugProbesKt.bin")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.profileinstaller)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    // Google sign-in for homes and shops (admins sign in with a password; the server refuses Google for them)
    "gharImplementation"(libs.credentials)
    "gharImplementation"(libs.credentials.play.services)
    "gharImplementation"(libs.googleid)
    "dukaanImplementation"(libs.credentials)
    "dukaanImplementation"(libs.credentials.play.services)
    "dukaanImplementation"(libs.googleid)

    // Counter scanning: camera + on-device barcode reading, only in the shop app
    "dukaanImplementation"(libs.camerax.camera2)
    "dukaanImplementation"(libs.camerax.lifecycle)
    "dukaanImplementation"(libs.camerax.view)
    "dukaanImplementation"(libs.mlkit.barcode)
}
