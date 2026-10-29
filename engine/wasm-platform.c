/* Browser Workers have no POSIX process signals. Report the unsupported
 * operation explicitly; do not leave a latent unresolved-symbol abort in Perl. */
#include <errno.h>
#include <signal.h>

int sigsuspend(const sigset_t *mask) {
    (void)mask;
    errno = ENOSYS;
    return -1;
}
