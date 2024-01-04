socket IO client settings

URL = http://localhost:3001?userId=
URL should contain userId.. or socket conection will be disconnected

socket header should contain
{
"transports":["websocket","polling"]
}
