package pe.qorigo.auth.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import pe.qorigo.shared.application.CurrentUser;

/**
 * Identidad del portal. El id de persona siempre sale de la sesión; cualquier
 * valor enviado por el cliente se ignora.
 */
@Path("/mi/perfil")
@Produces(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed({"ADMIN", "MEMBER"})
public class PortalIdentidadResource {

    @Inject
    CurrentUser currentUser;

    @GET
    public PerfilResponse perfil() {
        return new PerfilResponse(
                currentUser.idUsuario(),
                currentUser.idPersona(),
                currentUser.email(),
                currentUser.rol());
    }

    public record PerfilResponse(Long idUsuario, Long idPersona, String email, String rol) {
    }
}
