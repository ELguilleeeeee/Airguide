
  # AirGuide
  # Aclaraciones:
  Debes clonar este repo y el repo del backend
  Frontend: https://github.com/luiss811/Airguide.git
  Backend: https://github.com/luiss811/Backend-Airguide.git
  
  ## Pasos para correr el proyecto

  #1. Abre la terminal en Visual Studio Code
  En la rama principal ``` \Airguide> ``` 
  
  Ejecuta el comando 
  ```bash
  npm install --legacy-peer-deps 
  ```
  . Tardara unos minutos. Cuando finalice, abre una nueva terminal en Visual Studio Code y navega hacia el backend. ``` cd Backend-Airguide ```

  #2. Servidor Backend
  En la rama del servidor ``` \Backend-Airguide> ```

  Ejecuta el comando 
  ```bash 
  npm install --legacy-peer-deps
  ```
  . Cuando finalice; deberas crear un archivo llamado .env, lo creas y pegas este codigo:
  
  ---
  ```bash
  DATABASE_URL="postgres://95f5f1214a82708148a9b43e39fa1e41e4060e963ee217d0c4174044af1541f9:sk_XYgJ7P5CcF3TPpb0XVgW0@pooled.db.prisma.io:5432/postgres?sslmode=require"

  #URL DEVELOPMENT  http://localhost:3001/api || https://airguide-lac.vercel.app
  API_URL="http://localhost:3001/api"
  API_KEY="AIzaSyBCORaDyk1go3cDfKQNSM9-CS8wv12GSJM"
  # Server
  NODE_ENV="development"
  # JWT
  JWT_SECRET="67c87664b5bba0c8746a21b017b4ea71"
  JWT_EXPIRES_IN="1d"

  # CORS http://localhost:5173
  CORS_ORIGIN="http://localhost:5173"

  # Email / SMTP (for 2FA OTP)
  # Gmail example: use an App Password (not your account password)
  # Generate one at: https://myaccount.google.com/apppasswords
  SMTP_HOST="smtp.gmail.com"
  SMTP_PORT="587"
  SMTP_SECURE="false"
  SMTP_USER="lalitorios81@gmail.com"
  SMTP_PASS="yxyx dcqh nqag nant"
  SMTP_FROM="AirGuide <lalitorios81@gmail.com>"
  ```

  #3. En la carpeta Airguide, crea otro archivo .env y pega este codigo:
  ---
  ```bash
  VITE_API_URL=http://localhost:3001/api
  ```
  #4. Ahora sí, en la terminal del servidor backend (Terminal 2), ejecuta el comando 
  ```bash 
  npm run dev
  ```
  . Eso debe de inciar el servidor.

  #5. En la terminal del frontend (Terminal 1), ejecuta el comando 
  ```bash 
  npm run dev
  ```
  . Eso debe de inciar el frontend.
  
