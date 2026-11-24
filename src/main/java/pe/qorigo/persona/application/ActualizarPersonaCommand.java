package pe.qorigo.persona.application;

public record ActualizarPersonaCommand(
        String nombres,
        String apellidos,
        String documento,
        String telefono,
        String email,
        String direccion,
        Boolean activo,
        boolean confirmarDuplicado
) {
}
