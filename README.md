# PWA Záznamník (Synchronizovaný s webem a mobilem)

Tato aplikace slouží jako synchronizovaný poznámkový blok. Díky integraci **Next.js** a **Supabase** probíhá synchronizace okamžitě (Real-time). Můžete si ji nainstalovat z prohlížeče na mobil i plochu PC.

## 1. Zprovoznění Databáze (Supabase)
1. Běžte na [supabase.com](https://supabase.com) a vytvořte si bezplatný účet/projekt.
2. Ve vašem novém projektu přejděte do `SQL Editor` a vložte následující příkaz k vytvoření tabulky:
   ```sql
   CREATE TABLE notes (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     title text,
     content text,
     created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
   );
   ```
3. Z nastavení projektu zkopírujte `Project URL` a `anon public key`.
4. V lokálním projektu vytvořte `.env.local` ze šablony `.env.example` a vyplňte získané hodnoty.
5. **DŮLEŽITÉ:** Pro fungování "Real-time" synchronizace jděte zleva v menu do sekce `Database` -> `Replication`, klikněte na "Source", zapněte tabulku `notes` a celou replikaci uložte. Tím se poznámky objeví z mobilu do vteřiny on-line v PC.

## 2. Nahrání na GitHub
Otevřete terminál ve složce projektu a zadejte:
```bash
git add .
git commit -m "Initial commit s PWA a UI"
git branch -M main
git remote add origin https://github.com/VASE_UZIVATELSKE_JMENO/VASE_REPO.git
git push -u origin main
```
*(Nezapomeňte si na GitHubu nejdříve vytvořit prázdný repozitář a nahradit odkaz svým.)*

## 3. Nasazení na Vercel
1. Přihlaste se na [Vercel.com](https://vercel.com) s vaším GitHub účtem.
2. Klikněte na **Add New...** -> **Project**.
3. Importujte váš nově nahraný repozitář `notes-pwa` (nebo pod libovolným jménem, které jste zvolili).
4. **VELMI DŮLEŽITÉ:** V sekci **Environment Variables** nezapomeňte přidat:
   - `NEXT_PUBLIC_SUPABASE_URL` a zadejte vaši URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` a zadejte váš klíč.
5. Klikněte na **Deploy**.

Během chvíle Vercel vygeneruje vaši unikátní URL, ze které bude aplikace přístupná. Stačí si ji otevřít v mobilu, kliknout v prohlížeči na `Přídat na domovskou obrazovku` a máte vlastní super rychlou aplikaci!
