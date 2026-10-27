# kotlinx.serialization, OkHttp, Coil, CameraX and ML Kit ship their own R8 rules.

# Credential Manager finds its Play Services provider by reflection.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }

# ML Kit creates its components by class name from manifest meta-data; R8 full mode would strip them and
# BarcodeScanning.getClient() then crashes with a NullPointerException (release builds only).
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode_bundled.** { *; }
-keep class * implements com.google.firebase.components.ComponentRegistrar { <init>(); }

# Keep line numbers so crash reports point at real code.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
