import { redirect } from "next/navigation";

// /account is intentionally a thin redirect to /settings — the avatar
// dropdown's "Account" entry points here, but the actual account-management
// surface (sign-in alerts, sessions, two-factor, passkeys, data export) all
// live under /settings. Keeping a public /account route avoids 404s on old
// bookmarks and any in-app links from earlier waves.
const AccountPage = (): never => {
    redirect("/settings");
};

export default AccountPage;
