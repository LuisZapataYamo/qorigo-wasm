package pe.qorigo.shared.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Puerto de tiempo. Permite fijar el reloj en las pruebas sin depender del
 * reloj del sistema.
 */
public interface Reloj {

    Instant ahora();

    LocalDate hoy();

    default YearMonth mesActual() {
        return YearMonth.from(hoy());
    }
}
