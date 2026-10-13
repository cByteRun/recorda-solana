# Workspace profile and appearance

The dashboard header contains the environment selector, appearance button, EN/RU selector and current identity. The desktop sidebar contains the Recorda logo above navigation and the profile button below workspace details. The profile opens the same panel as the header; compact screens retain the quick navigation and avatar. The profile shows the current role, environment, access type and public wallet address, with address copying and sign out. Desktop navigation remains in the sidebar; phones show every role-allowed tab in a two-row bottom navigation with the profile button, including all 11 operator tabs. Tablets retain the scrollable icon rail and full navigation menu.

Appearance offers Light / Dark and 20 accent palettes, including Lavanda and Coffee. Each palette displays its swatch and HEX. Accent colors and their derived surfaces apply to the dashboard, cards, hero, fields and profile; theme changes retain the current role and portfolio. The native modal supports Escape, focus return, focus trapping and backdrop dismissal.

Preferences are stored locally under `recorda-theme`, `recorda-palette` and `recorda-language`, independently of wallet identity, and survive reload and environment changes. They grant no permissions.

EN/RU uses an explicit React message catalog in `src/shared/preferences/translations.ts`. Navigation, profile, login, operational overview, portfolio, deadlines, settlements, audit and role cabinets consume the shared provider. Dates in these cabinets follow the selected language. On-chain identifiers, names, retained evidence and transaction signatures remain verbatim. Low-level transaction setup/runner screens have their existing copy; additional translations can be added as they adopt the same provider.

Verification: `tests/workspace-preferences.spec.ts` covers real theme colors, all palettes, persistence, portfolio retention, language updates, keyboard focus and desktop/mobile panel layouts. Existing RBAC and workspace tests cover sign out and entry.
