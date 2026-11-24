package pe.qorigo.persona.application;

public record RegistrarPersonaCommand(
        String nombres,
        String apellidos,
        String documento,
        String telefono,
        String email,
        String direccion,
        boolean confirmarDuplicado
) {
}
