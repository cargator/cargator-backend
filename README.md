# Socket Server

This repository contains the Socket Server for the CarGator application, providing real-time communication capabilities between the CarGator components.

## Running the Socket Server Locally

### Prerequisites

- Node.js with version 18.x (with npm) installed on your machine.
- Docker cli with version 24.x
- Docker Compose cli with version 1.29.2

### Installation

1. Clone the Socket Server repository:

    ```bash
    $ git clone https://github.com/cargator/socket-server.git
    $ cd socket-server
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
$ docker build -t cargator-socket-server .
```

```bash
# run command
$ docker run --network host -p 3001:3001 -d cargator-socket-server:latest
```
