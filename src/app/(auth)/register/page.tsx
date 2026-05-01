import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthRegisterForm } from "@/components/auth/AuthRegisterForm";
import { getPrivacyMode } from "@/lib/site-config";

export const metadata: Metadata = {
    title: "Create an account",
};

const RegisterPage = async () => {
    const mode = await getPrivacyMode();
    // Closed-registration modes hide the page outright. login-only forbids
    // both browsing and signing up; public-closed allows anonymous viewing
    // but still blocks new accounts.
    if (mode === "login-only" || mode === "public-closed") {
        notFound();
    }

    return <AuthRegisterForm />;
};

export default RegisterPage;
