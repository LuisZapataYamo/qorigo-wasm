package pe.qorigo.auth.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import pe.qorigo.auth.application.AutenticarUseCase;
import pe.qorigo.auth.application.CerrarSesionUseCase;
import pe.qorigo.auth.application.RecuperarPasswordUseCase;
import pe.qorigo.auth.application.RestablecerPasswordUseCase;

import java.time.Instant;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
public class AuthResource {

    @Inject
    AutenticarUseCase autenticar;

    @Inject
    CerrarSesionUseCase cerrarSesion;

    @Inject
    RecuperarPasswordUseCase recuperarPassword;

    @Inject
    RestablecerPasswordUseCase restablecerPassword;

    @Inject
    AuthRestMapper mapper;

    @Inject
    JsonWebToken jwt;

    @POST
    @Path("/login")
    public LoginResponse login(@Valid LoginRequest request) {
        return mapper.aResponse(autenticar.ejecutar(request.email(), request.password()));
    }

    @POST
    @Path("/logout")
    @RolesAllowed({"ADMIN", "MEMBER"})
    public Response logout() {
        String jti = jwt.getClaim("jti");
        long exp = jwt.getExpirationTime();
        cerrarSesion.ejecutar(jti, exp > 0 ? Instant.ofEpochSecond(exp) : null);
        return Response.noContent().build();
    }

    @POST
    @Path("/recuperar")
    public Response recuperar(@Valid RecuperarRequest request) {
        RecuperarPasswordUseCase.RecuperacionSolicitada resultado = recuperarPassword.ejecutar(request.email());
        return Response.accepted(new RecuperarResponse(resultado.mensaje(), resultado.token())).build();
    }

    @POST
    @Path("/restablecer")
    public Response restablecer(@Valid RestablecerRequest request) {
        restablecerPassword.ejecutar(request.token(), request.nuevaPassword());
        return Response.noContent().build();
    }
}
