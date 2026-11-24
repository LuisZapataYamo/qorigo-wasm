package pe.qorigo.suscripcion.infrastructure.rest;

import jakarta.enterprise.context.ApplicationScoped;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.infrastructure.rest.PaginaResponse;
import pe.qorigo.suscripcion.application.SuscripcionDetalle;
import pe.qorigo.suscripcion.domain.Suscripcion;

@ApplicationScoped
public class SuscripcionRestMapper {

    public SuscripcionResponse aResponse(SuscripcionDetalle detalle) {
        Suscripcion suscripcion = detalle.suscripcion();
        return new SuscripcionResponse(
                suscripcion.idSuscripcion(),
                suscripcion.idPlataforma(),
                suscripcion.nombre(),
                suscripcion.moneda(),
                suscripcion.costo(),
                suscripcion.periodicidad(),
                suscripcion.capacidad(),
                suscripcion.diaCobro(),
                suscripcion.fechaInicio(),
                suscripcion.estado() == null ? null : suscripcion.estado().name(),
                detalle.plazasOcupadas(),
                detalle.plazasLibres(),
                detalle.costoPorPlaza(),
                detalle.cobertura(),
                detalle.alertaDeficit(),
                suscripcion.creadoEn());
    }

    public PaginaResponse<SuscripcionResponse> aPagina(Pagina<SuscripcionDetalle> pagina) {
        return PaginaResponse.de(pagina, this::aResponse);
    }
}
