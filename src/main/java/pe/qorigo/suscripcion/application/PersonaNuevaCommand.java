package pe.qorigo.suscripcion.application;

public record PersonaNuevaCommand(
        String nombres,
        String apellidos,
        String documento,
        String telefono,
        String email,
        String direccion
) {
}
