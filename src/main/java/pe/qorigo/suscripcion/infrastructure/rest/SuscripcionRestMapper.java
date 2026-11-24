package pe.qorigo.suscripcion.infrastructure.rest;

import jakarta.enterprise.context.ApplicationScoped;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.infrastructure.rest.PaginaResponse;
import pe.qorigo.suscripcion.application.AgregarMiembroCommand;
import pe.qorigo.suscripcion.application.MiembroDetalle;
import pe.qorigo.suscripcion.application.PersonaNuevaCommand;
import pe.qorigo.suscripcion.application.SuscripcionDetalle;
import pe.qorigo.suscripcion.domain.MiembroSuscripcion;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.util.List;

@ApplicationScoped
public class SuscripcionRestMapper {

    public SuscripcionResponse aResponse(SuscripcionDetalle detalle) {
        return aResponse(detalle, List.of());
    }

    public SuscripcionResponse aResponse(SuscripcionDetalle detalle, List<MiembroDetalle> miembros) {
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
                suscripcion.creadoEn(),
                miembros.stream().map(this::aResponse).toList());
    }

    public MiembroResponse aResponse(MiembroDetalle detalle) {
        MiembroSuscripcion miembro = detalle.miembro();
        return new MiembroResponse(
                miembro.idMiembro(),
                miembro.idSuscripcion(),
                miembro.idPersona(),
                detalle.nombres(),
                detalle.apellidos(),
                detalle.documento(),
                miembro.montoAcordado(),
                miembro.esPlazaPropia(),
                miembro.fechaInicio(),
                miembro.fechaFin(),
                miembro.estado() == null ? null : miembro.estado().name(),
                miembro.creadoEn());
    }

    public PaginaResponse<SuscripcionResponse> aPagina(Pagina<SuscripcionDetalle> pagina) {
        return PaginaResponse.de(pagina, this::aResponse);
    }

    public AgregarMiembroCommand aCommand(AgregarMiembroRequest request) {
        PersonaNuevaCommand persona = request.persona() == null
                ? null
                : new PersonaNuevaCommand(
                        request.persona().nombres(),
                        request.persona().apellidos(),
                        request.persona().documento(),
                        request.persona().telefono(),
                        request.persona().email(),
                        request.persona().direccion());
        return new AgregarMiembroCommand(
                request.idPersona(),
                persona,
                request.montoAcordado(),
                request.esPlazaPropia(),
                request.fechaInicio(),
                request.confirmaDuplicado());
    }
}
