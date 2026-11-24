package pe.qorigo.persona.infrastructure.rest;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.persona.application.ActualizarPersonaCommand;
import pe.qorigo.persona.application.DeudaPorMoneda;
import pe.qorigo.persona.application.FichaPersona;
import pe.qorigo.persona.application.PagoReciente;
import pe.qorigo.persona.application.PrestamoDePersona;
import pe.qorigo.persona.application.RegistrarPersonaCommand;
import pe.qorigo.persona.application.SuscripcionDePersona;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.infrastructure.rest.PaginaResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface PersonaRestMapper {

    PersonaResponse aResponse(Persona persona);

    FichaPersonaResponse aResponse(FichaPersona ficha);

    SuscripcionFichaResponse aResponse(SuscripcionDePersona suscripcion);

    PrestamoFichaResponse aResponse(PrestamoDePersona prestamo);

    DeudaMonedaResponse aResponse(DeudaPorMoneda deuda);

    PagoFichaResponse aResponse(PagoReciente pago);

    default PaginaResponse<PersonaResponse> aPagina(Pagina<Persona> pagina) {
        return PaginaResponse.de(pagina, this::aResponse);
    }

    default RegistrarPersonaCommand aCommand(CrearPersonaRequest request) {
        return new RegistrarPersonaCommand(
                request.nombres(),
                request.apellidos(),
                request.documento(),
                request.telefono(),
                request.email(),
                request.direccion(),
                request.confirmaDuplicado());
    }

    default ActualizarPersonaCommand aCommand(ActualizarPersonaRequest request) {
        return new ActualizarPersonaCommand(
                request.nombres(),
                request.apellidos(),
                request.documento(),
                request.telefono(),
                request.email(),
                request.direccion(),
                request.activo(),
                request.confirmaDuplicado());
    }
}
