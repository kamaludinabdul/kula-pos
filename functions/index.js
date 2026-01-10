/* eslint-env node */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Updates a user's password.
 * Only accessible by authenticated users with 'admin' or 'super_admin' roles,
 * or the user themselves (though client SDK handles that usually).
 * 
 * Args:
 * - targetUserId: string (The UID of the user to update)
 * - newPassword: string (The new password)
 * - targetEmail: string (Optional: Email to restore user if missing in Auth)
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    // 1. Authenticated?
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Request must be authenticated."
        );
    }

    const callerUid = context.auth.uid;
    const targetUserId = data.targetUserId;
    const newPassword = data.newPassword;
    const targetEmail = data.targetEmail;

    if (!targetUserId || !newPassword) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Missing targetUserId or newPassword."
        );
    }

    if (newPassword.length < 6) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Password must be at least 6 characters."
        );
    }

    try {
        // 2. Authorization Check
        // Get Caller Data
        const callerSnap = await admin.firestore().collection("users").doc(callerUid).get();
        if (!callerSnap.exists) {
            throw new functions.https.HttpsError("permission-denied", "Caller profile not found.");
        }
        const callerData = callerSnap.data();

        // Get Target Data
        const targetSnap = await admin.firestore().collection("users").doc(targetUserId).get();
        if (!targetSnap.exists) {
            // Might be a ghost user in Auth but deleted in Firestore? 
            // Proceeding might be dangerous if we can't verify Store ownership.
            throw new functions.https.HttpsError("not-found", "Target user profile not found.");
        }
        const targetData = targetSnap.data();

        // Logic:
        // - Super Admin can update anyone
        // - Admin can update users in THEIR Store
        // - User can update themselves (redundant but safe)

        let allowed = false;

        if (callerData.role === 'super_admin') {
            allowed = true;
        } else if (callerUid === targetUserId) {
            allowed = true;
        } else if (callerData.role === 'admin' || callerData.role === 'administrator') {
            // Check Store Match
            if (callerData.storeId && callerData.storeId === targetData.storeId) {
                allowed = true;
            }
        }

        if (!allowed) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "You do not have permission to update this user's password."
            );
        }

        // 3. Perform Update
        try {
            await admin.auth().updateUser(targetUserId, {
                password: newPassword,
            });
            console.log(`Password updated for user ${targetUserId} by ${callerUid}`);
        } catch (authError) {
            // Detect if user missing in Auth but exists in DB (Legacy/Ghost user)
            if (authError.code === 'auth/user-not-found') {
                console.warn(`User ${targetUserId} not found in Auth. Attempting to create/restore...`);

                if (!targetEmail) {
                    throw new functions.https.HttpsError(
                        "failed-precondition",
                        "User not found in Auth system and no email provided to restore them."
                    );
                }

                // Create the user with the SAME UID from Firestore
                await admin.auth().createUser({
                    uid: targetUserId,
                    email: targetEmail,
                    password: newPassword,
                    emailVerified: true // Auto-verify since admin created
                });
                console.log(`Restored missing Auth user: ${targetUserId} (${targetEmail})`);
            } else {
                throw authError;
            }
        }

        console.log(`Password updated for user ${targetUserId} by ${callerUid}`);
        return { success: true, message: "Password updated successfully." };

    } catch (error) {
        console.error("Error updating password:", error);
        // Re-throw valid HttpsErrors
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Internal server error.");
    }
});
