# Cargator Backend

This repository contains the Socket Server for the CarGator application, providing real-time communication capabilities between the CarGator components.

## Running the Socket Server Locally

### Prerequisites

- Node.js with version 18.x (with npm) installed on your machine.
- Docker cli with version 24.x
- Docker Compose cli with version 1.29.2

### Installation

1. Clone the Socket Server repository:

    ```bash
    $ git clone https://github.com/cargator/cargator-backend
    $ cd cargator-backend
    ```

2. Install dependencies:

    ```bash
    $ npm install
    ```

3. Configuration:

    - Create a `.env` file in the root directory by copying the contents from `sample.env`.
    - Customize the variables in the `.env` file based on your specific requirements.

### Start Redis and Mongodb locally

```bash
$ docker-compose up -d mongodb redis
```

### Start the Socket Server locally

```bash
$ npm run start:dev
```

### Build and Run Backend locally

```bash
# build command
$ npm run build
```

```bash
# run command
$ npm run start
```

### Build and Run Docker container locally

```bash
# build command
$ docker build -t cargator-backend .
```

```bash
# run command
$ docker run --network host -p 3001:3001 -d cargator-backend:latest
```

# Deploying to Google Cloud Run with Docker

### Prerequisites

- Google Cloud SDK: Ensure that you have the Google Cloud SDK installed on your machine.
- Docker: Make sure Docker is installed and running on your machine.

# Google Cloud Setup

1. Authenticate with Google Cloud:

- gcloud auth login

2. Set your project:

- gcloud config set project mystic-song-410112

3. Enable the necessary services:

- gcloud services enable cloudbuild.googleapis.com
- gcloud services enable run.googleapis.com

### Docker Setup and Deployment

1. Build the Docker image:

```bash
$ docker build --no-cache -t gcr.io/mystic-song-410112/sukam .
```

2. Push the Docker image to Google Container Registry:

```bash
$ docker push gcr.io/mystic-song-410112/sukam
```

3. Deploy the Docker image to Google Cloud Run:

```bash
$ gcloud run deploy sukam --image gcr.io/mystic-song-410112/sukam:latest --platform managed --port 8080 --region asia-southeast1 --project mystic-song-410112
```

### Notes

Google Cloud Run assigns this environment variable automatically
