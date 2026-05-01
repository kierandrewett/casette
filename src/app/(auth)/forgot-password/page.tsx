import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
    title: "Forgot password",
};

const ForgotPasswordPage = () => {
    return <ForgotPasswordForm />;
};

export default ForgotPasswordPage;
