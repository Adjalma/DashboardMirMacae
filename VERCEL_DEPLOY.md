# Configurar Deploy na Vercel

Se o build falhar com `npm install`, ajuste o projeto na Vercel:

1. Acesse **vercel.com** → seu projeto **DashboardMirMacae**
2. **Settings** → **General** → **Build & Development Settings**
3. Em **Override**, verifique:
   - **Install Command**: deixe **vazio** (para auto-detectar pnpm) OU use `pnpm install`
   - **Build Command**: deixe vazio OU `pnpm run build`
   - **Output Directory**: `dist/public`
4. Salve e faça **Redeploy** na aba Deployments

O projeto usa **pnpm** (`pnpm-lock.yaml`). Não use `npm install` nas configurações.
