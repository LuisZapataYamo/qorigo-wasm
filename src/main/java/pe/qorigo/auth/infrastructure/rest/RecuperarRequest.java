package pe.qorigo.auth.infrastructure.rest;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecuperarRequest(@NotBlank @Email @Size(max = 150) String email) {
}
