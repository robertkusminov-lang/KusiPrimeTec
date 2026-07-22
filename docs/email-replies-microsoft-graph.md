# E-Mail-Antworten im Ticketsystem - Microsoft-Graph-Integration

Die eingehende Mailintegration ist bis zu einer gesonderten Konfiguration und Freigabe deaktiviert. Eine spaetere Umsetzung muss mindestens diese Punkte verbindlich klaeren und testen:

- festgelegtes Postfach und Mailfolder
- vorhandene Entra-App-Registrierung, Tenant-ID und Client-ID
- sicher gespeicherte Credentials
- produktive `notificationUrl` und geheimes `clientState`
- `clientState`-Pruefung fuer jede Notification
- Behandlung der Graph-`validationToken`-Anfrage
- Speicherung von Subscription-ID und Ablaufdatum
- automatische Erneuerung und Lifecycle Notifications
- Replay- und Idempotenzschutz
- sichere Zuordnung von Nachricht und Ticket
- Groessen- und Dateityplimits
- isolierter Test- und Rollbackplan

Diese Notiz ist keine Freigabe zur Implementierung oder Aktivierung.
